export type ShiftType = "normal" | "saturday";

export type BillingBand = {
  upToHours: number | null;
  multiplier: number;
};

export type BillingRule = {
  minBillableHours: number;
  bands: BillingBand[];
  saturdayMultiplier: number;
};

export type QuoteLine = {
  fromHour: number;
  toHour: number;
  hours: number;
  multiplier: number;
  amount: number;
  kind: "labor" | "pad" | "saturday" | "commute";
};

export type PerWorkerQuote = {
  workHours: number;
  billedLaborHours: number;
  laborCost: number;
  commuteRoundTrip: number;
  absorbedCommute: number;
  remainingCommute: number;
  commuteCost: number;
  lines: QuoteLine[];
};

export type JobQuote = {
  workersCount: number;
  perWorker: PerWorkerQuote;
  laborTotal: number;
  commuteHoursTotal: number;
  commuteCost: number;
  carCost: number;
  grandTotal: number;
};

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

export function computeExpenseTotal(
  quantity: number,
  unitRate: number,
): number {
  return round2(quantity * unitRate);
}

/** Latest rule with effectiveFrom <= date. */
export function resolveByEffectiveFrom<T extends { effectiveFrom: string }>(
  rows: T[],
  date: string,
): T | null {
  const eligible = rows
    .filter((r) => r.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return eligible[0] ?? null;
}

export function computeLaborBands(
  workHours: number,
  shiftType: ShiftType,
  rule: BillingRule,
  hourlyRate: number,
): { billedLaborHours: number; laborCost: number; lines: QuoteLine[] } {
  const minH = rule.minBillableHours;
  const billedLaborHours = Math.max(workHours, minH);
  const lines: QuoteLine[] = [];

  if (shiftType === "saturday") {
    const amount = round2(
      billedLaborHours * hourlyRate * rule.saturdayMultiplier,
    );
    lines.push({
      fromHour: 0,
      toHour: billedLaborHours,
      hours: billedLaborHours,
      multiplier: rule.saturdayMultiplier,
      amount,
      kind: "saturday",
    });
    return { billedLaborHours, laborCost: amount, lines };
  }

  const bands = [...rule.bands].sort((a, b) => {
    if (a.upToHours == null) return 1;
    if (b.upToHours == null) return -1;
    return a.upToHours - b.upToHours;
  });

  let prevCap = 0;
  let cursor = 0;
  for (const band of bands) {
    const cap = band.upToHours ?? Number.POSITIVE_INFINITY;
    const hoursInBand = Math.max(0, Math.min(workHours, cap) - prevCap);
    if (hoursInBand > 0) {
      const amount = round2(hoursInBand * hourlyRate * band.multiplier);
      lines.push({
        fromHour: cursor,
        toHour: cursor + hoursInBand,
        hours: hoursInBand,
        multiplier: band.multiplier,
        amount,
        kind: "labor",
      });
      cursor += hoursInBand;
    }
    prevCap = cap;
    if (cursor >= workHours) break;
  }

  const pad = Math.max(0, billedLaborHours - workHours);
  if (pad > 0) {
    const amount = round2(pad * hourlyRate);
    lines.push({
      fromHour: cursor,
      toHour: cursor + pad,
      hours: pad,
      multiplier: 1,
      amount,
      kind: "pad",
    });
  }

  const laborCost = round2(lines.reduce((s, l) => s + l.amount, 0));
  return { billedLaborHours, laborCost, lines };
}

export function computeCommute(
  workHours: number,
  commuteRateOneWay: number,
  hourlyRate: number,
  minHours: number,
): {
  commuteRoundTrip: number;
  absorbedCommute: number;
  remainingCommute: number;
  commuteCost: number;
  line: QuoteLine | null;
} {
  const commuteRoundTrip = round2(commuteRateOneWay * 2);
  const absorbedCommute = round2(
    Math.min(commuteRoundTrip, Math.max(0, minHours - workHours)),
  );
  const remainingCommute = round2(commuteRoundTrip - absorbedCommute);
  const commuteCost = round2(remainingCommute * hourlyRate);
  const line =
    remainingCommute > 0
      ? {
          fromHour: 0,
          toHour: remainingCommute,
          hours: remainingCommute,
          multiplier: 1,
          amount: commuteCost,
          kind: "commute" as const,
        }
      : null;
  return {
    commuteRoundTrip,
    absorbedCommute,
    remainingCommute,
    commuteCost,
    line,
  };
}

export function computeJobQuote(input: {
  workHours: number;
  workersCount: number;
  shiftType: ShiftType;
  hourlyRate: number;
  rule: BillingRule;
  commuteRateOneWay: number;
  includeCar: boolean;
  carRate: number;
}): JobQuote {
  const workersCount = Math.max(0, input.workersCount);
  const labor = computeLaborBands(
    input.workHours,
    input.shiftType,
    input.rule,
    input.hourlyRate,
  );
  const commute = computeCommute(
    input.workHours,
    input.commuteRateOneWay,
    input.hourlyRate,
    input.rule.minBillableHours,
  );
  const lines = [...labor.lines];
  if (commute.line) lines.push(commute.line);

  const perWorker: PerWorkerQuote = {
    workHours: input.workHours,
    billedLaborHours: labor.billedLaborHours,
    laborCost: labor.laborCost,
    commuteRoundTrip: commute.commuteRoundTrip,
    absorbedCommute: commute.absorbedCommute,
    remainingCommute: commute.remainingCommute,
    commuteCost: commute.commuteCost,
    lines,
  };

  const laborTotal = round2(perWorker.laborCost * workersCount);
  const commuteHoursTotal = round2(
    perWorker.commuteRoundTrip * workersCount,
  );
  const commuteCost = round2(perWorker.commuteCost * workersCount);
  const carCost = input.includeCar ? round2(input.carRate) : 0;
  const grandTotal = round2(laborTotal + commuteCost + carCost);

  return {
    workersCount,
    perWorker,
    laborTotal,
    commuteHoursTotal,
    commuteCost,
    carCost,
    grandTotal,
  };
}

/** Default billing rule matching product defaults. */
export const DEFAULT_BILLING_RULE: BillingRule = {
  minBillableHours: 8,
  bands: [
    { upToHours: 8, multiplier: 1 },
    { upToHours: 10, multiplier: 1.25 },
    { upToHours: null, multiplier: 1.5 },
  ],
  saturdayMultiplier: 2,
};

export type ReportBandHours = {
  h100: number;
  h125: number;
  h150: number;
  h200: number;
  travelHours: number;
  totalH: number;
  payment: number;
};

export function buildReportBands(
  workHours: number,
  travelHours: number,
  shiftType: ShiftType,
  rule: BillingRule,
  hourlyRate: number,
): ReportBandHours {
  const travel = Math.max(0, travelHours);
  let h100 = 0;
  let h125 = 0;
  let h150 = 0;
  let h200 = 0;

  const billed = Math.max(workHours, rule.minBillableHours);

  if (shiftType === "saturday") {
    h200 = billed;
  } else {
    const bands = [...rule.bands].sort((a, b) => {
      if (a.upToHours == null) return 1;
      if (b.upToHours == null) return -1;
      return a.upToHours - b.upToHours;
    });
    let prevCap = 0;
    let remaining = billed;
    for (const band of bands) {
      if (remaining <= 0) break;
      const cap = band.upToHours ?? Number.POSITIVE_INFINITY;
      const span = Math.max(0, Math.min(billed, cap) - prevCap);
      const take = Math.min(remaining, span);
      if (take > 0) {
        if (band.multiplier <= 1) h100 += take;
        else if (band.multiplier <= 1.25) h125 += take;
        else if (band.multiplier <= 1.5) h150 += take;
        else h200 += take;
        remaining -= take;
      }
      prevCap = cap;
    }
    if (remaining > 0) h150 += remaining;
  }

  const totalH = round2(
    h100 * 1 + h125 * 1.25 + h150 * 1.5 + h200 * 2 + travel * 1,
  );
  const payment = round2(totalH * hourlyRate);

  return {
    h100: round2(h100),
    h125: round2(h125),
    h150: round2(h150),
    h200: round2(h200),
    travelHours: round2(travel),
    totalH,
    payment,
  };
}
