export type AddonType = "car_drive" | "parking" | "other";

export type AddonInput = {
  type: AddonType;
  amount: number;
  note?: string;
};

export type ClientRates = {
  rateMode: "hourly" | "daily";
  hourlyRate: number;
  dailyRate?: number;
  extraHourRate?: number;
  carHourlyRate?: number;
};

export type EntryCost = {
  laborCost: number;
  addonCost: number;
  lineTotal: number;
};

export function computeLaborCost(hours: number, rates: ClientRates): number {
  if (rates.rateMode === "daily") {
    const base = rates.dailyRate ?? rates.hourlyRate * 8;
    const extraHours = Math.max(0, hours - 8);
    const extraRate = rates.extraHourRate ?? rates.hourlyRate;
    return round2(base + extraHours * extraRate);
  }
  return round2(hours * rates.hourlyRate);
}

export function computeAddonCost(
  addons: AddonInput[],
  rates: ClientRates,
): number {
  let total = 0;
  for (const addon of addons) {
    if (addon.type === "car_drive") {
      total += addon.amount * (rates.carHourlyRate ?? 0);
    } else {
      total += addon.amount;
    }
  }
  return round2(total);
}

export function computeEntryCost(
  hours: number,
  rates: ClientRates,
  addons: AddonInput[],
): EntryCost {
  const laborCost = computeLaborCost(hours, rates);
  const addonCost = computeAddonCost(addons, rates);
  return {
    laborCost,
    addonCost,
    lineTotal: round2(laborCost + addonCost),
  };
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
