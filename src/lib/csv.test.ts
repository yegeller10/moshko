import { describe, expect, it } from "vitest";
import { parseEntriesCsv, CSV_TEMPLATE_HEADER } from "./csv";

describe("parseEntriesCsv", () => {
  it("parses valid rows", () => {
    const text = [
      CSV_TEMPLATE_HEADER,
      "Dana,Acme,Tel Aviv,2026-08-01,08:00,16:00,1,20,0,",
    ].join("\n");
    const rows = parseEntriesCsv(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].worker_name).toBe("Dana");
    expect(rows[0].car_hours).toBe(1);
    expect(rows[0].parking).toBe(20);
  });

  it("flags bad dates", () => {
    const text = [
      CSV_TEMPLATE_HEADER,
      "Dana,Acme,TV,01/08/2026,08:00,16:00,0,0,0,",
    ].join("\n");
    const rows = parseEntriesCsv(text);
    expect(rows[0].errors.some((e) => e.includes("date"))).toBe(true);
  });
});
