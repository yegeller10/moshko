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

/**
 * Phase 1: base labor only (no overtime bands until configured).
 * Daily mode: one dailyRate per entry (full day), extras use extraHourRate or hourlyRate.
 */
export function computeLaborCost(
  hours: number,
  rates: ClientRates,
): number {
  if (rates.rateMode === "daily") {
    const base = rates.dailyRate ?? rates.hourlyRate * 8;
    // Extra hours beyond a standard day (8h) billed at extra/hourly when present
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
      const rate = rates.carHourlyRate ?? 0;
      total += addon.amount * rate;
    } else {
      // parking / other — amount is money
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
