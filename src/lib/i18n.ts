import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import he from "@/locales/he.json";
import en from "@/locales/en.json";

const saved = localStorage.getItem("moshko.lang");
const lng = saved === "en" || saved === "he" ? saved : "he";

void i18n.use(initReactI18next).init({
  resources: {
    he: { translation: he },
    en: { translation: en },
  },
  lng,
  fallbackLng: "he",
  interpolation: { escapeValue: false },
});

export function applyDocumentDirection(language: string) {
  const dir = language === "he" ? "rtl" : "ltr";
  document.documentElement.lang = language;
  document.documentElement.dir = dir;
}

applyDocumentDirection(lng);

i18n.on("languageChanged", (language) => {
  localStorage.setItem("moshko.lang", language);
  applyDocumentDirection(language);
});

export default i18n;
