import { describe, expect, it } from "vitest";
import { parseEntriesCsv, CSV_TEMPLATE_HEADER } from "./csv";

describe("parseEntriesCsv", () => {
  it("parses valid rows", () => {
    const text = [
      CSV_TEMPLATE_HEADER,
      "Dana,Acme,Tel Aviv,2026-08-01,08:00,16:00,note",
    ].join("\n");
    const rows = parseEntriesCsv(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].worker_name).toBe("Dana");
    expect(rows[0].note).toBe("note");
  });

  it("flags bad dates", () => {
    const text = [
      CSV_TEMPLATE_HEADER,
      "Dana,Acme,TV,01/08/2026,08:00,16:00,",
    ].join("\n");
    const rows = parseEntriesCsv(text);
    expect(rows[0].errors.some((e) => e.includes("date"))).toBe(true);
  });
});
