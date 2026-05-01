'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';

const STORAGE_KEY = 'met_admin_lang';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: 'fr',
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
  });

// Persist language changes to localStorage
i18n.on('languageChanged', (lng: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, lng);
  }
});

export default i18n;
