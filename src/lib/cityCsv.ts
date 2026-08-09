export const CITY_CSV_HEADER =
  "city_name,effective_from,car_rate,commute_rate";

export const CITY_CSV_TEMPLATE = [
  CITY_CSV_HEADER,
  "תל אביב,2020-01-01,250,1.5",
  "Tel Aviv,2026-01-01,280,1.75",
].join("\n");

export type ParsedCityCsvRow = {
  rowNumber: number;
  city_name: string;
  effective_from: string;
  car_rate: number;
  commute_rate: number;
  errors: string[];
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCityCsv(text: string): ParsedCityCsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const expected = CITY_CSV_HEADER.split(",");
  const missing = expected.filter((h) => !header.includes(h));
  if (missing.length) {
    return [
      {
        rowNumber: 1,
        city_name: "",
        effective_from: "",
        car_rate: 0,
        commute_rate: 0,
        errors: [`Missing columns: ${missing.join(", ")}`],
      },
    ];
  }

  const idx = Object.fromEntries(expected.map((h) => [h, header.indexOf(h)]));

  return lines.slice(1).map((line, i) => {
    const cols = parseCsvLine(line);
    const city_name = cols[idx.city_name] ?? "";
    const effective_from = cols[idx.effective_from] ?? "";
    const carRaw = cols[idx.car_rate] ?? "";
    const commuteRaw = cols[idx.commute_rate] ?? "";
    const car_rate = Number(carRaw);
    const commute_rate = Number(commuteRaw);
    const errors: string[] = [];
    if (!city_name.trim()) errors.push("city_name required");
    if (!DATE_RE.test(effective_from)) errors.push("invalid effective_from");
    if (!Number.isFinite(car_rate) || car_rate < 0) errors.push("invalid car_rate");
    if (!Number.isFinite(commute_rate) || commute_rate < 0) {
      errors.push("invalid commute_rate");
    }
    return {
      rowNumber: i + 2,
      city_name: city_name.trim(),
      effective_from,
      car_rate,
      commute_rate,
      errors,
    };
  });
}

export function downloadCityCsvTemplate() {
  const blob = new Blob([CITY_CSV_TEMPLATE + "\n"], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cities-rates-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}
