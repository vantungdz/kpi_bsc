import { createI18n } from "vue-i18n";
import { ref } from "vue";
import en from "./assets/locales/en.json";
import vi from "./assets/locales/vi.json";
import ja from "./assets/locales/ja.json";

// Lấy locale từ localStorage nếu có, nếu không thì dùng 'en'
const savedLocale = localStorage.getItem("locale") || "en";

const i18n = createI18n({
  legacy: false, // Sử dụng Composition API
  locale: savedLocale, // default locale lấy từ localStorage
  fallbackLocale: "en", // fallback locale
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
  i18nLocale.value = locale; // Ensure reactivity
  localStorage.setItem("locale", locale); // Lưu vào localStorage
}

export function useCurrentLocale() {
  return currentLocale;
}

export function useI18nLocale() {
  return i18nLocale;
}

export default i18n;
