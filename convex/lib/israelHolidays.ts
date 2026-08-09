/** Gregorian dates for major Israel public holidays (HE titles). */
export type IsraelHoliday = {
  key: string;
  date: string;
  titleHe: string;
  titleEn: string;
};

const RAW: Array<{ key: string; date: string; he: string; en: string }> = [
  // 2025
  { key: "purim-2025", date: "2025-03-14", he: "פורים", en: "Purim" },
  { key: "pesach-2025-1", date: "2025-04-13", he: "פסח", en: "Passover" },
  { key: "pesach-2025-7", date: "2025-04-19", he: "שביעי של פסח", en: "Passover (7th)" },
  { key: "yom-hashoah-2025", date: "2025-04-24", he: "יום השואה", en: "Holocaust Remembrance Day" },
  { key: "yom-hazikaron-2025", date: "2025-04-30", he: "יום הזיכרון", en: "Memorial Day" },
  { key: "yom-haatzmaut-2025", date: "2025-05-01", he: "יום העצמאות", en: "Independence Day" },
  { key: "shavuot-2025", date: "2025-06-02", he: "שבועות", en: "Shavuot" },
  { key: "tisha-bav-2025", date: "2025-08-03", he: "תשעה באב", en: "Tisha B'Av" },
  { key: "rosh-2025-1", date: "2025-09-23", he: "ראש השנה", en: "Rosh Hashanah" },
  { key: "rosh-2025-2", date: "2025-09-24", he: "ראש השנה ב׳", en: "Rosh Hashanah (2)" },
  { key: "yom-kippur-2025", date: "2025-10-02", he: "יום כיפור", en: "Yom Kippur" },
  { key: "sukkot-2025", date: "2025-10-07", he: "סוכות", en: "Sukkot" },
  { key: "simchat-torah-2025", date: "2025-10-14", he: "שמחת תורה", en: "Simchat Torah" },
  // 2026
  { key: "purim-2026", date: "2026-03-03", he: "פורים", en: "Purim" },
  { key: "pesach-2026-1", date: "2026-04-02", he: "פסח", en: "Passover" },
  { key: "pesach-2026-7", date: "2026-04-08", he: "שביעי של פסח", en: "Passover (7th)" },
  { key: "yom-hashoah-2026", date: "2026-04-14", he: "יום השואה", en: "Holocaust Remembrance Day" },
  { key: "yom-hazikaron-2026", date: "2026-04-21", he: "יום הזיכרון", en: "Memorial Day" },
  { key: "yom-haatzmaut-2026", date: "2026-04-22", he: "יום העצמאות", en: "Independence Day" },
  { key: "shavuot-2026", date: "2026-05-22", he: "שבועות", en: "Shavuot" },
  { key: "tisha-bav-2026", date: "2026-07-23", he: "תשעה באב", en: "Tisha B'Av" },
  { key: "rosh-2026-1", date: "2026-09-12", he: "ראש השנה", en: "Rosh Hashanah" },
  { key: "rosh-2026-2", date: "2026-09-13", he: "ראש השנה ב׳", en: "Rosh Hashanah (2)" },
  { key: "yom-kippur-2026", date: "2026-09-21", he: "יום כיפור", en: "Yom Kippur" },
  { key: "sukkot-2026", date: "2026-09-26", he: "סוכות", en: "Sukkot" },
  { key: "simchat-torah-2026", date: "2026-10-03", he: "שמחת תורה", en: "Simchat Torah" },
  // 2027
  { key: "purim-2027", date: "2027-03-23", he: "פורים", en: "Purim" },
  { key: "pesach-2027-1", date: "2027-04-22", he: "פסח", en: "Passover" },
  { key: "pesach-2027-7", date: "2027-04-28", he: "שביעי של פסח", en: "Passover (7th)" },
  { key: "yom-haatzmaut-2027", date: "2027-05-12", he: "יום העצמאות", en: "Independence Day" },
  { key: "shavuot-2027", date: "2027-06-11", he: "שבועות", en: "Shavuot" },
  { key: "rosh-2027-1", date: "2027-10-02", he: "ראש השנה", en: "Rosh Hashanah" },
  { key: "rosh-2027-2", date: "2027-10-03", he: "ראש השנה ב׳", en: "Rosh Hashanah (2)" },
  { key: "yom-kippur-2027", date: "2027-10-11", he: "יום כיפור", en: "Yom Kippur" },
  { key: "sukkot-2027", date: "2027-10-16", he: "סוכות", en: "Sukkot" },
  { key: "simchat-torah-2027", date: "2027-10-23", he: "שמחת תורה", en: "Simchat Torah" },
];

export function israelHolidays(): IsraelHoliday[] {
  return RAW.map((r) => ({
    key: r.key,
    date: r.date,
    titleHe: r.he,
    titleEn: r.en,
  }));
}

export function israelHolidaysInRange(
  fromDate: string,
  toDate: string,
): IsraelHoliday[] {
  return israelHolidays().filter(
    (h) => h.date >= fromDate && h.date <= toDate,
  );
}
