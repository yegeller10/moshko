export const CSV_TEMPLATE_HEADER =
  "worker_name,client_name,location,date,start_time,end_time,note";

export const CSV_TEMPLATE_EXAMPLE = [
  CSV_TEMPLATE_HEADER,
  "דני כהן,לקוח אלפא,תל אביב,2026-08-01,08:00,16:00,",
  "Dana Levi,Client Beta,Haifa,2026-08-02,09:00,17:30,setup",
].join("\n");

export type ParsedCsvRow = {
  rowNumber: number;
  worker_name: string;
  client_name: string;
  location: string;
  date: string;
  start_time: string;
  end_time: string;
  note: string;
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
const TIME_RE = /^\d{2}:\d{2}$/;

export function parseEntriesCsv(text: string): ParsedCsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const expected = CSV_TEMPLATE_HEADER.split(",");
  const missing = expected.filter((h) => !header.includes(h));
  if (missing.length) {
    return [
      {
        rowNumber: 1,
        worker_name: "",
        client_name: "",
        location: "",
        date: "",
        start_time: "",
        end_time: "",
        note: "",
        errors: [`Missing columns: ${missing.join(", ")}`],
      },
    ];
  }

  const idx = Object.fromEntries(expected.map((h) => [h, header.indexOf(h)]));

  return lines.slice(1).map((line, i) => {
    const cols = parseCsvLine(line);
    const get = (key: string) => cols[idx[key]] ?? "";
    const errors: string[] = [];
    const worker_name = get("worker_name");
    const client_name = get("client_name");
    const location = get("location");
    const date = get("date");
    const start_time = get("start_time");
    const end_time = get("end_time");
    const note = get("note");

    if (!worker_name) errors.push("worker_name required");
    if (!client_name) errors.push("client_name required");
    if (!location) errors.push("location required");
    if (!DATE_RE.test(date)) errors.push("date must be YYYY-MM-DD");
    if (!TIME_RE.test(start_time)) errors.push("start_time must be HH:mm");
    if (!TIME_RE.test(end_time)) errors.push("end_time must be HH:mm");

    return {
      rowNumber: i + 2,
      worker_name,
      client_name,
      location,
      date,
      start_time,
      end_time,
      note,
      errors,
    };
  });
}

export function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE_EXAMPLE + "\n"], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "entries-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}
