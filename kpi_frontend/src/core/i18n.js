import { createI18n } from 'vue-i18n';
import { ref } from 'vue';
import en from './assets/locales/en.json';
import vi from './assets/locales/vi.json';

const i18n = createI18n({
  legacy: false, // Sử dụng Composition API
  locale: 'en', // default locale
  fallbackLocale: 'en', // fallback locale
  messages: {
    en,
    vi,
  },
});

const currentLocale = ref('en');
const i18nLocale = ref(i18n.global.locale);

export function setLocale(locale) {
  currentLocale.value = locale;
  i18n.global.locale = locale;
  i18nLocale.value = locale; // Ensure reactivity
}

export function useCurrentLocale() {
  return currentLocale;
}

export function useI18nLocale() {
  return i18nLocale;
}

export default i18n;