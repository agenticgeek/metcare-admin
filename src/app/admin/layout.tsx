'use client';

import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { LanguageToggle } from '@/components/LanguageToggle';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  // Don't show navbar on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <header className="bg-cherry-brown text-white shadow-md z-10 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo placeholder - replace with actual METCARE logo */}
            <div className="text-xl font-bold font-heading text-snow-white tracking-wide">
              METCARE
            </div>
            <div className="h-6 w-px bg-white/20 hidden sm:block"></div>
            <div className="text-sm font-medium font-heading text-white/80 hidden sm:block" suppressHydrationWarning>
              {t('login.title')}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 hover:bg-white/10 text-white/90 hover:text-white"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
