/**
 * Offer PDF builder — HTML/SVG → PNG → A4 PDF.
 * Uses satori (dir:rtl) so Hebrew + numbers render like 308-he.pdf.
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { PDFDocument } from "pdf-lib";
import { NOTO_SANS_HEBREW_REGULAR_BASE64 } from "./hebrewFontBase64";
import { NOTO_SANS_REGULAR_BASE64 } from "./latinFontBase64";
import { LOGO_PNG_BASE64 } from "./logoPngBase64";

const BRAND = "#0b6fc2";
const INK = "#0d0d0d";
const MUTED = "#6b6b6b";
const LINE = "#d4d4d8";
const PAGE_W = 794; // ~A4 @ 96dpi
const PAGE_H = 1123;
const FONT_STACK = "Noto Sans Hebrew, Noto Sans";

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

function money(n: number) {
  return (
    "₪" +
    n.toLocaleString("he-IL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatIssuedAt(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateOnly(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export type OfferPdfInput = {
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
};

function buildTree(args: OfferPdfInput, logoDataUri: string | null): VNode {
  const { offer } = args;
  const co = offer.companySnapshot;
  const bank = offer.bankSnapshot;
  const vatPct = Math.round(offer.vatRate * 100);
  const terms = bank.paymentTerms
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const row = (
    qty: string,
    desc: string,
    price: string,
    total: string,
    opts?: { header?: boolean; muted?: boolean },
  ) =>
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          direction: "ltr",
          width: "100%",
          padding: opts?.header ? "0 0 8px" : "10px 0",
          borderBottom: `1px solid ${LINE}`,
          fontSize: opts?.header ? 12 : 13,
          color: opts?.muted ? MUTED : INK,
          fontWeight: opts?.header ? 700 : 400,
        },
      },
      // LTR: left → right = סה״כ, מחיר, פירוט, כמות
      el(
        "div",
        {
          style: {
            width: 110,
            textAlign: "left",
            flexShrink: 0,
          },
        },
        total,
      ),
      el(
        "div",
        {
          style: {
            width: 100,
            textAlign: "left",
            flexShrink: 0,
          },
        },
        price,
      ),
      el(
        "div",
        {
          style: {
            flex: 1,
            textAlign: "right",
            paddingLeft: 12,
            paddingRight: 8,
            lineHeight: 1.45,
            direction: "rtl",
          },
        },
        desc,
      ),
      el(
        "div",
        {
          style: {
            width: 48,
            textAlign: "right",
            flexShrink: 0,
            direction: "rtl",
          },
        },
        qty,
      ),
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
        direction: "rtl",
        padding: "28px 36px 24px",
      },
    },
    // Header: logo LEFT, blue box RIGHT (explicit LTR flex row)
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
          marginBottom: 28,
          width: "100%",
          direction: "ltr",
        },
      },
      // LEFT: logo + company
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            maxWidth: 220,
            direction: "rtl",
          },
        },
        logoDataUri
          ? el("img", {
              src: logoDataUri,
              width: 140,
              height: 90,
              style: {
                objectFit: "contain",
                marginBottom: 10,
              },
            })
          : el(
              "div",
              {
                style: {
                  fontSize: 18,
                  fontWeight: 700,
                  color: BRAND,
                  marginBottom: 8,
                  textAlign: "right",
                  width: "100%",
                },
              },
              co.name,
            ),
        el(
          "div",
          {
            style: {
              fontSize: 12,
              color: MUTED,
              textAlign: "right",
              width: "100%",
              lineHeight: 1.5,
            },
          },
          `עוסק מורשה ${co.vatId}`,
        ),
        el(
          "div",
          {
            style: {
              fontSize: 12,
              color: MUTED,
              textAlign: "right",
              width: "100%",
              lineHeight: 1.5,
            },
          },
          co.address,
        ),
        co.emails
          ? el(
              "div",
              {
                style: {
                  fontSize: 11,
                  color: MUTED,
                  textAlign: "right",
                  width: "100%",
                },
              },
              co.emails,
            )
          : null,
      ),
      // RIGHT: blue client box
      el(
        "div",
        {
          style: {
            width: 340,
            background: BRAND,
            color: "#ffffff",
            borderRadius: 2,
            padding: "16px 18px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            direction: "rtl",
          },
        },
        el(
          "div",
          { style: { fontSize: 13, textAlign: "right" } },
          formatDateOnly(args.issuedAt),
        ),
        el(
          "div",
          { style: { fontSize: 13, textAlign: "right", marginTop: 4 } },
          "לכבוד:",
        ),
        el(
          "div",
          {
            style: {
              fontSize: 14,
              fontWeight: 700,
              textAlign: "right",
              lineHeight: 1.35,
            },
          },
          args.clientName,
        ),
        args.clientEmails
          ? el(
              "div",
              {
                style: {
                  fontSize: 11,
                  textAlign: "right",
                  opacity: 0.95,
                },
              },
              args.clientEmails,
            )
          : null,
        el("div", {
          style: {
            height: 1,
            background: "rgba(255,255,255,0.85)",
            margin: "10px 0 12px",
            width: "100%",
          },
        }),
        el(
          "div",
          {
            style: {
              fontSize: 26,
              fontWeight: 700,
              textAlign: "right",
              lineHeight: 1.2,
            },
          },
          `הצעת מחיר ${offer.number}`,
        ),
        el(
          "div",
          {
            style: {
              fontSize: 12,
              textAlign: "right",
              marginTop: 4,
              opacity: 0.95,
            },
          },
          "העתק נאמן למקור",
        ),
      ),
    ),
    // Title
    el(
      "div",
      {
        style: {
          fontSize: 18,
          fontWeight: 700,
          textAlign: "right",
          marginBottom: 18,
        },
      },
      offer.title,
    ),
    // Table header
    row("כמות", "פירוט", "מחיר", "סה״כ", { header: true, muted: true }),
    // Lines
    ...offer.lineItems.map((item) =>
      row(
        String(item.quantity),
        item.description,
        money(item.unitPrice),
        money(item.total),
      ),
    ),
    // Totals
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          marginTop: 14,
          gap: 8,
          width: "100%",
        },
      },
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            direction: "ltr",
            justifyContent: "space-between",
            fontSize: 14,
          },
        },
        el("div", { style: { textAlign: "left" } }, money(offer.subtotal)),
        el("div", { style: { textAlign: "right", direction: "rtl" } }, "סה״כ"),
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            direction: "ltr",
            justifyContent: "space-between",
            fontSize: 14,
          },
        },
        el("div", { style: { textAlign: "left" } }, money(offer.vatAmount)),
        el(
          "div",
          { style: { textAlign: "right", direction: "rtl" } },
          `מע״מ ${vatPct}%`,
        ),
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            direction: "ltr",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 4,
          },
        },
        el(
          "div",
          {
            style: {
              background: BRAND,
              color: "#ffffff",
              padding: "6px 14px",
              fontSize: 16,
              fontWeight: 700,
              textAlign: "left",
            },
          },
          money(offer.grandTotal),
        ),
        el(
          "div",
          {
            style: {
              fontSize: 16,
              fontWeight: 700,
              textAlign: "right",
              direction: "rtl",
            },
          },
          "סה״כ לתשלום",
        ),
      ),
    ),
    offer.attention
      ? el(
          "div",
          {
            style: {
              marginTop: 22,
              fontSize: 14,
              textAlign: "right",
            },
          },
          `לידי ${offer.attention}`,
        )
      : null,
    el("div", {
      style: {
        height: 1,
        background: LINE,
        width: "100%",
        marginTop: 18,
        marginBottom: 14,
      },
    }),
    // Bank
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 13,
          textAlign: "right",
          lineHeight: 1.45,
        },
      },
      ...terms.map((line, i) =>
        el(
          "div",
          {},
          i === 0 && !line.startsWith("*") ? `* ${line}` : line,
        ),
      ),
      el("div", {}, bank.payee),
      el("div", {}, bank.bank),
      el("div", {}, bank.branch),
      el("div", {}, `מ.ח ${bank.account}`),
    ),
    // Spacer
    el("div", { style: { flex: 1 } }),
    // Footer
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
          marginTop: 16,
        },
      },
      el(
        "div",
        {
          style: {
            fontSize: 10,
            color: MUTED,
            textAlign: "left",
          },
        },
        "created by moshkoprod",
      ),
      el(
        "div",
        {
          style: {
            fontSize: 10,
            color: MUTED,
            textAlign: "right",
            direction: "rtl",
          },
        },
        `הופק ב ${formatIssuedAt(args.issuedAt)} | הצעת מחיר ${offer.number} | עמוד 1 מתוך 1`,
      ),
    ),
  );
}

export async function buildOfferPdfBytes(
  args: OfferPdfInput,
): Promise<Uint8Array> {
  const hebData = Buffer.from(NOTO_SANS_HEBREW_REGULAR_BASE64, "base64");
  const latData = Buffer.from(NOTO_SANS_REGULAR_BASE64, "base64");
  const logoBytes = Buffer.from(LOGO_PNG_BASE64, "base64");
  const isJpeg = logoBytes[0] === 0xff && logoBytes[1] === 0xd8;
  const logoDataUri = `data:image/${isJpeg ? "jpeg" : "png"};base64,${LOGO_PNG_BASE64}`;

  const fonts = [
    {
      name: "Noto Sans Hebrew",
      data: hebData,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Noto Sans Hebrew",
      data: hebData,
      weight: 700 as const,
      style: "normal" as const,
    },
    {
      name: "Noto Sans",
      data: latData,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Noto Sans",
      data: latData,
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
    background: "#ffffff",
  });
  const png = resvg.render().asPng();

  const pdf = await PDFDocument.create();
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
