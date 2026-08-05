import { describe, expect, it } from "vitest";
import {
  computeAddonCost,
  computeEntryCost,
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

describe("computeAddonCost", () => {
  it("bills car hours and money addons", () => {
    expect(
      computeAddonCost(
        [
          { type: "car_drive", amount: 2 },
          { type: "parking", amount: 30 },
          { type: "other", amount: 20 },
        ],
        { rateMode: "hourly", hourlyRate: 100, carHourlyRate: 40 },
      ),
    ).toBe(130);
  });
});

describe("computeEntryCost", () => {
  it("sums labor and addons", () => {
    const result = computeEntryCost(
      8,
      { rateMode: "hourly", hourlyRate: 100, carHourlyRate: 50 },
      [{ type: "car_drive", amount: 1 }],
    );
    expect(result.laborCost).toBe(800);
    expect(result.addonCost).toBe(50);
    expect(result.lineTotal).toBe(850);
  });
});
