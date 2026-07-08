import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import zhCN from './locales/zh-CN.json'

// Supported languages
export const supportedLanguages = [
  { code: 'zh-CN', label: '简体中文', shortLabel: '中' },
] as const

export type LanguageCode = (typeof supportedLanguages)[number]['code']

// Default language
export const defaultLanguage: LanguageCode = 'zh-CN'

// Resource configuration
const resources = {
  'zh-CN': { translation: zhCN },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: defaultLanguage,
    supportedLngs: supportedLanguages.map((lang) => lang.code),
    interpolation: {
      escapeValue: false, // React already handles XSS
    },
    detection: {
      // Language detection order: URL param > localStorage > navigator > fallback
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      // URL parameter name: ?lang=en-US or ?lang=zh-CN
      lookupQuerystring: 'lang',
      // Cache language selection
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

export default i18n

