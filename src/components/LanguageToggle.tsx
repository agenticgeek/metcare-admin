'use client';

import { useTranslation } from 'react-i18next';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const toggleLang = () => {
    const newLang = currentLang === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLang}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 hover:bg-white/10"
      style={{ fontFamily: 'Poppins, sans-serif' }}
      title={currentLang === 'fr' ? 'Switch to English' : 'Passer en français'}
    >
      <span
        className={`transition-opacity ${currentLang === 'fr' ? 'opacity-100' : 'opacity-50'}`}
      >
        🇫🇷
      </span>
      <span className="text-white/60">/</span>
      <span
        className={`transition-opacity ${currentLang === 'en' ? 'opacity-100' : 'opacity-50'}`}
      >
        🇬🇧
      </span>
    </button>
  );
}
