import { describe, expect, it } from "vitest";
import {
  computeExpenseTotal,
  computeHours,
  computeLaborCost,
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

describe("computeLaborCost", () => {
  it("uses hourly rate", () => {
    expect(
      computeLaborCost(6, { rateMode: "hourly", hourlyRate: 100 }),
    ).toBe(600);
  });

  it("uses daily rate with extra hours", () => {
    expect(
      computeLaborCost(10, {
        rateMode: "daily",
        hourlyRate: 50,
        dailyRate: 400,
        extraHourRate: 75,
      }),
    ).toBe(550);
  });
});

describe("computeExpenseTotal", () => {
  it("multiplies quantity by rate", () => {
    expect(computeExpenseTotal(2, 40)).toBe(80);
    expect(computeExpenseTotal(1, 25)).toBe(25);
  });
});
