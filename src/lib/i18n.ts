import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/i18n/locales/en.json'
import hr from '@/i18n/locales/hr.json'

const savedLang = localStorage.getItem('wf-lang') || 'hr'

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hr: { translation: hr } },
  lng: savedLang,
  fallbackLng: 'hr',
  interpolation: { escapeValue: false },
})

export default i18n
