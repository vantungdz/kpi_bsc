import { createI18n } from "vue-i18n";
import { ref } from "vue";
import en from "./assets/locales/en.json";
import vi from "./assets/locales/vi.json";
import ja from "./assets/locales/ja.json";

const savedLocale = localStorage.getItem("locale") || "en";

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: "en",
  messages: {
    en,
    vi,
    ja,
  },
});

const currentLocale = ref(savedLocale);
const i18nLocale = ref(i18n.global.locale);

export function setLocale(locale) {
  currentLocale.value = locale;
  i18n.global.locale = locale;
  i18nLocale.value = locale;
  localStorage.setItem("locale", locale);
}

export function useCurrentLocale() {
  return currentLocale;
}

export function useI18nLocale() {
  return i18nLocale;
}

export default i18n;
