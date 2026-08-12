import satori from "satori";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { PDFDocument } from "pdf-lib";
import bidiFactory from "bidi-js";
import { composeBankFooter } from "./offerDefaults";
import { HEEBO_REGULAR_BASE64 } from "./heeboRegularBase64";
import { HEEBO_BOLD_BASE64 } from "./heeboBoldBase64";
import { LOGO_PNG_BASE64 } from "./logoPngBase64";
import { RESVG_WASM_BASE64 } from "./resvgWasmBase64";

const BRAND = "#5d92e4"; // sample 308-heEditable blue
const INK = "#111111";
const MUTED = "#5a5a5a";
const LINE = "#c8c8c8";
const PAGE_W = 794; // ~A4 @ 96dpi
const PAGE_H = 1123;
const FONT_STACK = "Heebo";
const bidi = bidiFactory();

/**
 * Satori does not layout Hebrew correctly with direction:rtl.
 * Convert logical → visual order and draw as LTR + textAlign:right.
 */
function pdfText(s: string): string {
  const normalized = s
    .replace(/\u05F4/g, '"')
    .replace(/\u05F3/g, "'")
    .replace(/ל-\s+(\d)/g, "ל-$1");
  if (!/[\u0590-\u05FF]/.test(normalized)) return normalized;
  const levels = bidi.getEmbeddingLevels(normalized);
  return bidi.getReorderedString(normalized, levels);
}

let wasmReady: Promise<void> | null = null;
function ensureResvgWasm() {
  if (!wasmReady) {
    wasmReady = initWasm(Buffer.from(RESVG_WASM_BASE64, "base64"));
  }
  return wasmReady;
}

type VNode =
  | string
  | number
  | null
  | false
  | {
      type: string;
      props: Record<string, unknown> & { children?: VNode | VNode[] };
    };

function el(
  type: string,
  props: Record<string, unknown> | null,
  ...kids: VNode[]
): VNode {
  const flat = kids
    .flat()
    .filter((c) => c !== null && c !== false && c !== undefined);
  const style = {
    display: "flex",
    flexDirection: "column",
    ...((props?.style as Record<string, unknown>) ?? {}),
  };
  // Text-only leaves shouldn't force column flex quirks
  const onlyText =
    flat.length === 1 && (typeof flat[0] === "string" || typeof flat[0] === "number");
  return {
    type,
    props: {
      ...(props ?? {}),
      style: onlyText
        ? { ...((props?.style as Record<string, unknown>) ?? {}) }
        : style,
      children: flat.length <= 1 ? (flat[0] ?? undefined) : flat,
    },
  };
}

export function formatMoneyShekel(n: number) {
  return (
    "₪" +
    n.toLocaleString("he-IL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function money(n: number) {
  return formatMoneyShekel(n);
}

function formatDateOnly(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatIssuedAt(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type OfferPdfInput = {
  offer: {
    number: number;
    title: string;
    attention?: string;
    lineItems: Array<{
      quantity: number;
      description: string;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
    vatRate: number;
    vatAmount: number;
    grandTotal: number;
    companySnapshot: {
      name: string;
      vatId: string;
      address: string;
      emails: string;
    };
    bankSnapshot: {
      payee: string;
      bank: string;
      branch: string;
      account: string;
      paymentTerms: string;
    };
  };
  clientName: string;
  clientEmails: string;
  issuedAt: number;
  contentHash?: string;
};

function buildTree(args: OfferPdfInput, logoDataUri: string | null): VNode {
  const { offer } = args;
  const co = offer.companySnapshot;
  const bank = offer.bankSnapshot;
  const vatPct = Math.round(offer.vatRate * 100);
  const footerSource = composeBankFooter({
    paymentTerms: bank.paymentTerms,
    bankPayee: bank.payee,
    bankName: bank.bank,
    bankBranch: bank.branch,
    bankAccount: bank.account,
  });
  const terms = footerSource
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      const logical = i === 0 && !l.startsWith("*") ? `* ${l}` : l;
      return pdfText(logical);
    });

  const t = (s: string) => pdfText(s);

  const cell = (
    width: number | "flex",
    content: string,
    opts: {
      align?: "left" | "right" | "center";
      direction?: "ltr" | "rtl";
      padL?: number;
      padR?: number;
      /** false for pure LTR (money/emails) */
      override?: boolean;
      fontWeight?: number;
      color?: string;
    } = {},
  ) =>
    el(
      "div",
      {
        style: {
          ...(width === "flex" ? { flex: 1 } : { width, flexShrink: 0 }),
          textAlign: opts.align ?? "right",
          direction: opts.direction ?? "ltr",
          unicodeBidi: opts.override === false ? "normal" : "bidi-override",
          paddingLeft: opts.padL ?? 0,
          paddingRight: opts.padR ?? 0,
          lineHeight: 1.45,
          ...(opts.fontWeight ? { fontWeight: opts.fontWeight } : {}),
          ...(opts.color ? { color: opts.color } : {}),
        },
      },
      content,
    );

  const he = (content: string, style: Record<string, unknown> = {}) =>
    el(
      "div",
      {
        style: {
          direction: "ltr",
          unicodeBidi: "bidi-override",
          textAlign: "right",
          width: "100%",
          ...style,
        },
      },
      content,
    );

  const row = (
    qty: string,
    desc: string,
    price: string,
    total: string,
    opts?: { header?: boolean },
  ) =>
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          direction: "ltr",
          width: "100%",
          padding: opts?.header ? "0 0 8px" : "9px 0",
          borderBottom: `1px solid ${LINE}`,
          fontSize: opts?.header ? 12 : 11.5,
          color: INK,
          fontWeight: opts?.header ? 700 : 400,
          alignItems: "flex-start",
        },
      },
      cell(118, total, {
        align: "left",
        direction: "ltr",
        override: false,
        fontWeight: opts?.header ? 700 : 400,
      }),
      cell(100, price, {
        align: "left",
        direction: "ltr",
        override: false,
        fontWeight: opts?.header ? 700 : 400,
      }),
      cell("flex", desc, {
        align: "right",
        direction: "ltr",
        padL: 12,
        padR: 10,
        fontWeight: opts?.header ? 700 : 400,
      }),
      cell(52, qty, {
        align: "right",
        direction: "ltr",
        override: false,
        fontWeight: opts?.header ? 700 : 400,
      }),
    );

  const totalLine = (label: string, value: string) =>
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          direction: "ltr",
          width: "100%",
          fontSize: 14,
          padding: "4px 0",
        },
      },
      cell(118, value, { align: "left", direction: "ltr", override: false }),
      cell(100, "", { align: "left", override: false }),
      cell("flex", label, { align: "right", direction: "ltr", padR: 10 }),
      cell(52, "", { override: false }),
    );

  return el(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        color: INK,
        fontFamily: FONT_STACK,
        direction: "ltr",
        padding: "32px 40px 28px",
      },
    },
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 24,
          marginBottom: 30,
          width: "100%",
          direction: "ltr",
        },
      },
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            width: 200,
            direction: "ltr",
          },
        },
        logoDataUri
          ? el("img", {
              src: logoDataUri,
              width: 140,
              height: 90,
              style: { objectFit: "contain", marginBottom: 8 },
            })
          : null,
        he(t(co.name), {
          fontSize: 15,
          fontWeight: 700,
          textAlign: "right",
          marginBottom: 4,
        }),
        he(t(`עוסק מורשה ${co.vatId}`), {
          fontSize: 11,
          color: MUTED,
          textAlign: "right",
          lineHeight: 1.45,
        }),
        he(t(co.address), {
          fontSize: 11,
          color: MUTED,
          textAlign: "right",
          lineHeight: 1.45,
        }),
      ),
      el(
        "div",
        {
          style: {
            flex: 1,
            maxWidth: 480,
            minWidth: 420,
            background: BRAND,
            color: "#ffffff",
            padding: "16px 20px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            direction: "ltr",
            alignItems: "stretch",
          },
        },
        he(formatDateOnly(args.issuedAt), {
          fontSize: 13,
          unicodeBidi: "normal",
          textAlign: "right",
          display: "flex",
          justifyContent: "flex-end",
        }),
        he(t("לכבוד:"), { fontSize: 13, marginTop: 6, textAlign: "right" }),
        he(t(args.clientName), {
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1.35,
          textAlign: "right",
        }),
        args.clientEmails
          ? he(args.clientEmails, {
              fontSize: 11,
              opacity: 0.95,
              unicodeBidi: "normal",
              textAlign: "right",
            })
          : null,
        el("div", {
          style: {
            height: 1,
            background: "rgba(255,255,255,0.9)",
            margin: "10px 0 12px",
            width: "100%",
          },
        }),
        he(t(`הצעת מחיר ${offer.number}`), {
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1.15,
        }),
        he(t("העתק נאמן למקור"), {
          fontSize: 12,
          marginTop: 4,
          opacity: 0.95,
        }),
      ),
    ),
    he(t(offer.title), {
      fontSize: 17,
      fontWeight: 700,
      marginBottom: 16,
    }),
    row(t("כמות"), t("פירוט"), t("מחיר"), t('סה"כ'), { header: true }),
    ...offer.lineItems.map((item) =>
      row(
        String(item.quantity),
        t(item.description),
        money(item.unitPrice),
        money(item.total),
      ),
    ),
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          marginTop: 12,
          gap: 2,
          width: "100%",
        },
      },
      totalLine(t('סה"כ'), money(offer.subtotal)),
      totalLine(t(`מע"מ ${vatPct}%`), money(offer.vatAmount)),
      // Sample 308: blue amount pill on LEFT, black label on RIGHT
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            direction: "ltr",
            width: "100%",
            marginTop: 8,
            alignItems: "center",
            justifyContent: "space-between",
          },
        },
        el(
          "div",
          {
            style: {
              background: BRAND,
              color: "#ffffff",
              padding: "8px 16px",
              fontSize: 15,
              fontWeight: 700,
              textAlign: "left",
              direction: "ltr",
              unicodeBidi: "normal",
            },
          },
          money(offer.grandTotal),
        ),
        he(t('סה"כ לתשלום'), {
          fontSize: 15,
          fontWeight: 700,
          color: INK,
          width: "auto",
          textAlign: "right",
        }),
      ),
    ),    offer.attention
      ? he(t(`לידי ${offer.attention}`), {
          marginTop: 20,
          fontSize: 14,
          fontWeight: 700,
        })
      : null,
    // Push bank + signature to bottom of page (match 308)
    el("div", { style: { flex: 1, minHeight: 24 } }),
    el("div", {
      style: {
        height: 1,
        background: "#111111",
        width: "100%",
        marginBottom: 14,
      },
    }),
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 3,
          fontSize: 13,
          textAlign: "right",
          lineHeight: 1.5,
          direction: "ltr",
          width: "100%",
          alignItems: "flex-end",
        },
      },
      ...terms.map((line) =>
        he(line, {
          fontSize: 13,
          lineHeight: 1.5,
          textAlign: "right",
          width: "auto",
        }),
      ),
    ),
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          width: "100%",
          marginTop: 22,
          gap: 4,
        },
      },
      he(t("חתימה דיגיטלית מאובטחת"), {
        fontSize: 12,
        fontWeight: 700,
        color: INK,
        width: "auto",
        textAlign: "right",
      }),
      he(t("מסמך ממוחשב — נוצר ונחתם דיגיטלית ע״י moshkoprod"), {
        fontSize: 10,
        color: MUTED,
        width: "auto",
        textAlign: "right",
      }),
    ),
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          direction: "ltr",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderTop: `1px solid ${LINE}`,
          paddingTop: 10,
          marginTop: 14,
          width: "100%",
        },
      },
      el(
        "div",
        {
          style: {
            fontSize: 9,
            color: MUTED,
            textAlign: "left",
            direction: "ltr",
            unicodeBidi: "normal",
          },
        },
        args.contentHash
          ? `created by moshkoprod · ${args.contentHash.slice(0, 12)}`
          : "created by moshkoprod",
      ),
      he(
        t(
          `הופק ב ${formatIssuedAt(args.issuedAt)} | הצעת מחיר ${offer.number} | עמוד 1 מתוך 1`,
        ),
        {
          fontSize: 9,
          color: MUTED,
          width: "auto",
          textAlign: "right",
        },
      ),
    ),
  );
}

async function renderOfferPng(args: OfferPdfInput): Promise<Uint8Array> {
  await ensureResvgWasm();

  const regular = Buffer.from(HEEBO_REGULAR_BASE64, "base64");
  const bold = Buffer.from(HEEBO_BOLD_BASE64, "base64");
  const logoBytes = Buffer.from(LOGO_PNG_BASE64, "base64");
  const isJpeg = logoBytes[0] === 0xff && logoBytes[1] === 0xd8;
  const logoDataUri = `data:image/${isJpeg ? "jpeg" : "png"};base64,${LOGO_PNG_BASE64}`;

  const fonts = [
    {
      name: "Heebo",
      data: regular,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Heebo",
      data: bold,
      weight: 700 as const,
      style: "normal" as const,
    },
  ];

  const svg = await satori(buildTree(args, logoDataUri) as never, {
    width: PAGE_W,
    height: PAGE_H,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: PAGE_W * 2 },
    background: "white",
  });
  return resvg.render().asPng();
}

export async function buildOfferPdfBytes(
  args: OfferPdfInput,
): Promise<Uint8Array> {
  const hash =
    args.contentHash ??
    `offer-${args.offer.number}-${args.issuedAt}`;
  const png = await renderOfferPng({ ...args, contentHash: hash });
  const pdf = await PDFDocument.create();
  pdf.setTitle(`הצעת מחיר ${args.offer.number}`);
  pdf.setAuthor("moshkoprod");
  pdf.setProducer("moshkoprod digitally sealed offer");
  pdf.setCreator("moshkoprod");
  pdf.setCreationDate(new Date(args.issuedAt));
  pdf.setModificationDate(new Date(args.issuedAt));
  pdf.setKeywords([`seal:${hash}`, "digitally-sealed", "moshkoprod"]);
  pdf.setSubject(`Digitally sealed offer ${args.offer.number}`);

  const page = pdf.addPage([595.28, 841.89]);
  const image = await pdf.embedPng(png);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  });

  return pdf.save();
}

/** Dev/preview helper — same pixels as the PDF page. */
export async function buildOfferPngBytes(
  args: OfferPdfInput,
): Promise<Uint8Array> {
  return renderOfferPng(args);
}

