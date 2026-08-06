import { describe, expect, it } from "vitest";
import {
  DEFAULT_BILLING_RULE,
  computeCommute,
  computeExpenseTotal,
  computeHours,
  computeJobQuote,
  computeLaborBands,
} from "./costs";

describe("computeHours", () => {
  it("computes same-day duration", () => {
    expect(computeHours("08:00", "16:00")).toBe(8);
    expect(computeHours("09:30", "12:00")).toBe(2.5);
  });

  it("handles overnight", () => {
    expect(computeHours("22:00", "02:00")).toBe(4);
  });
});

describe("computeLaborBands", () => {
  it("pads under 8 to minimum at base", () => {
    const r = computeLaborBands(6, "normal", DEFAULT_BILLING_RULE, 100);
    expect(r.billedLaborHours).toBe(8);
    expect(r.laborCost).toBe(800);
  });

  it("applies 125% and 150% bands for 12h", () => {
    const r = computeLaborBands(12, "normal", DEFAULT_BILLING_RULE, 100);
    // 8*100 + 2*125 + 2*150 = 800 + 250 + 300 = 1350
    expect(r.laborCost).toBe(1350);
  });

  it("applies Saturday 200% with min 8", () => {
    const r = computeLaborBands(5, "saturday", DEFAULT_BILLING_RULE, 100);
    expect(r.billedLaborHours).toBe(8);
    expect(r.laborCost).toBe(1600);
  });
});

describe("computeCommute", () => {
  it("absorbs commute into min 8 (5h work, 1h one-way)", () => {
    // one-way 1 → round trip 2; W=5 → absorb 2, remaining 0 → total hours 8
    const c = computeCommute(5, 1, 100, 8);
    expect(c.commuteRoundTrip).toBe(2);
    expect(c.absorbedCommute).toBe(2);
    expect(c.remainingCommute).toBe(0);
    expect(c.commuteCost).toBe(0);
  });

  it("quotes 11h case: 7 work + 2h one-way", () => {
    // C=4; absorb 1; remaining 3; labor block 8 + 3 = 11
    const c = computeCommute(7, 2, 100, 8);
    expect(c.commuteRoundTrip).toBe(4);
    expect(c.absorbedCommute).toBe(1);
    expect(c.remainingCommute).toBe(3);
    expect(c.commuteCost).toBe(300);
  });
});

describe("computeJobQuote", () => {
  it("builds full quote for 7h + commute 2 one-way, 1 worker", () => {
    const q = computeJobQuote({
      workHours: 7,
      workersCount: 1,
      shiftType: "normal",
      hourlyRate: 100,
      rule: DEFAULT_BILLING_RULE,
      commuteRateOneWay: 2,
      includeCar: false,
      carRate: 0,
    });
    expect(q.perWorker.billedLaborHours).toBe(8);
    expect(q.perWorker.remainingCommute).toBe(3);
    expect(q.laborTotal).toBe(800);
    expect(q.commuteCost).toBe(300);
    expect(q.grandTotal).toBe(1100);
  });

  it("adds car once and multiplies workers", () => {
    const q = computeJobQuote({
      workHours: 8,
      workersCount: 2,
      shiftType: "normal",
      hourlyRate: 100,
      rule: DEFAULT_BILLING_RULE,
      commuteRateOneWay: 0,
      includeCar: true,
      carRate: 250,
    });
    expect(q.laborTotal).toBe(1600);
    expect(q.carCost).toBe(250);
    expect(q.grandTotal).toBe(1850);
  });
});

describe("computeExpenseTotal", () => {
  it("multiplies quantity by rate", () => {
    expect(computeExpenseTotal(2, 40)).toBe(80);
  });
});
