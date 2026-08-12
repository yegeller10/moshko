import { formatMoney } from "@/lib/costs";

/** Hebrew label on the right, amount on the left (LTR digits). */
export function RtlMoneyRow({
  label,
  amount,
  locale,
  bold,
  accent,
}: {
  label: string;
  amount: number;
  locale: string;
  bold?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${bold ? "font-semibold" : ""} ${accent ? "text-brand" : ""}`}
    >
      <span className="shrink-0 text-left tabular-nums" dir="ltr">
        {formatMoney(amount, locale)}
      </span>
      <span className="text-right">{label}</span>
    </div>
  );
}

export function RtlLineItemRow({
  description,
  quantity,
  total,
  locale,
}: {
  description: string;
  quantity: number;
  total: number;
  locale: string;
}) {
  return (
    <li className="rounded-xl border border-border px-3 py-2.5 text-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="shrink-0 pt-0.5 text-left tabular-nums font-medium" dir="ltr">
          {formatMoney(total, locale)}
        </span>
        <p className="flex-1 text-right leading-snug">{description}</p>
      </div>
      <p className="mt-1 text-right text-xs text-muted">
        {quantity} ×
      </p>
    </li>
  );
}
