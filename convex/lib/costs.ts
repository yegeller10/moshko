export type ClientRates = {
  rateMode: "hourly" | "daily";
  hourlyRate: number;
  dailyRate?: number;
  extraHourRate?: number;
};

export type ExpenseType = "car" | "parking" | "other";

export function computeLaborCost(hours: number, rates: ClientRates): number {
  if (rates.rateMode === "daily") {
    const base = rates.dailyRate ?? rates.hourlyRate * 8;
    const extraHours = Math.max(0, hours - 8);
    const extraRate = rates.extraHourRate ?? rates.hourlyRate;
    return round2(base + extraHours * extraRate);
  }
  return round2(hours * rates.hourlyRate);
}

export function computeExpenseTotal(
  quantity: number,
  unitRate: number,
): number {
  return round2(quantity * unitRate);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatMoney(n: number, locale = "he-IL"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(n);
}

export function computeHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end < start) end += 24 * 60;
  return Math.round(((end - start) / 60) * 100) / 100;
}
