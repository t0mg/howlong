import { en } from './locales/en';
import { fr } from './locales/fr';
import { es } from './locales/es';
import { de } from './locales/de';
import { ja } from './locales/ja';
import { zh } from './locales/zh';

export type Locale = 'en' | 'fr' | 'es' | 'de' | 'ja' | 'zh';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
  ja: '日本語',
  zh: '中文'
};

const translations: Record<Locale, Record<string, string>> = {
  en, fr, es, de, ja, zh
};

export function getBrowserLocale(): Locale {
  const lang = navigator.language.split('-')[0];
  if (lang in LOCALE_NAMES) {
    return lang as Locale;
  }
  return 'en';
}

let currentLocale: Locale = 'en';

export function getCurrentLocale(): Locale {
  return currentLocale;
}

export function t(key: string, params: Record<string, string | number> = {}): string {
  let text = translations[currentLocale]?.[key] || translations['en'][key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, String(v));
  }
  return text;
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
}
