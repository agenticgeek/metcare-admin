'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { LanguageToggle } from '@/components/LanguageToggle';

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push('/admin');
        router.refresh();
      } else {
        const data = await res.json();
        setError(t('login.error'));
      }
    } catch {
      setError(t('toast.error.generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 bg-cherry-brown rounded-lg text-white">
        <LanguageToggle />
      </div>
      
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-card-border overflow-hidden animate-scale-in">
        <div className="bg-cherry-brown px-8 py-10 text-center">
          <h1 className="text-3xl font-bold text-white font-heading tracking-wide mb-2">
            METCARE
          </h1>
          <p className="text-white/80 font-heading text-sm" suppressHydrationWarning>
            {t('login.title')}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-6">
          {error && (
            <div className="p-3 bg-destructive-bg text-destructive rounded-lg text-sm font-medium text-center border border-red-200">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-cherry-brown mb-2" style={{ fontFamily: 'Raleway, sans-serif' }}>
              {t('login.email')}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-input-border focus:border-silver-blue focus:ring-2 focus:ring-silver-blue/20 outline-none transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-cherry-brown mb-2" style={{ fontFamily: 'Raleway, sans-serif' }}>
              {t('login.password')}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-input-border focus:border-silver-blue focus:ring-2 focus:ring-silver-blue/20 outline-none transition-all"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-silver-blue text-white rounded-xl font-bold hover:bg-silver-blue-hover transition-colors flex items-center justify-center disabled:opacity-70 mt-4"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
