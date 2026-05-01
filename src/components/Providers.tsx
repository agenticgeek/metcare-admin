'use client';

import { I18nextProvider } from 'react-i18next';
import { useEffect } from 'react';
import i18n from '@/i18n';
import { ToastProvider } from './Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const storedLang = localStorage.getItem('met_admin_lang');
    if (storedLang && storedLang !== 'fr') {
      i18n.changeLanguage(storedLang);
    }
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </I18nextProvider>
  );
}
