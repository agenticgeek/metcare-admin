'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';

function ActivateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'form' | 'success' | 'error'>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Lien d\'activation invalide.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setErrorMessage('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
      } else {
        const errors: Record<string, string> = {
          'invalid_token': 'Ce lien est invalide.',
          'token_expired': 'Ce lien a expiré (validité 72h).',
          'token_replaced': 'Ce lien a été remplacé par un plus récent. Veuillez vérifier votre dernier email.',
          'already_active': 'Votre compte est déjà activé. Vous pouvez vous connecter.',
        };
        setErrorMessage(errors[data.error] || 'Une erreur est survenue lors de l\'activation.');
      }
    } catch {
      setErrorMessage('Erreur de connexion au serveur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'error' && !token) {
    return (
      <div className="min-h-screen bg-beige-skin/20 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-card-border shadow-sm max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold text-cherry-brown mb-2">Erreur d'activation</h1>
          <p className="text-muted-fg mb-6">Le jeton d'activation est manquant ou invalide.</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-beige-skin/20 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-card-border shadow-sm max-w-md w-full text-center animate-scale-in">
          <div className="w-16 h-16 bg-status-active/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-status-active" />
          </div>
          <h1 className="text-2xl font-bold text-cherry-brown mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Compte activé !
          </h1>
          <p className="text-muted-fg mb-8" style={{ fontFamily: 'Raleway, sans-serif' }}>
            Votre mot de passe a été enregistré avec succès. Vous pouvez maintenant accéder à votre espace formation.
          </p>
          <button
            onClick={() => window.location.href = 'https://metcare-frontend.vercel.app/sign-in'} // Placeholder for student portal
            className="w-full py-3 bg-silver-blue text-white rounded-xl font-semibold hover:bg-silver-blue-hover transition-colors shadow-sm"
          >
            Accéder à la formation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-beige-skin/20 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl border border-card-border shadow-xl max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-silver-blue/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-silver-blue" />
          </div>
          <h1 className="text-2xl font-bold text-cherry-brown" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Activez votre accès
          </h1>
          <p className="text-muted-fg mt-2" style={{ fontFamily: 'Raleway, sans-serif' }}>
            Veuillez définir un mot de passe pour sécuriser votre compte.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-cherry-brown mb-1.5" style={{ fontFamily: 'Raleway, sans-serif' }}>
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-input-border focus:ring-2 focus:ring-silver-blue/20 focus:border-silver-blue transition-all outline-none text-sm"
                placeholder="Minimum 8 caractères"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-fg hover:text-cherry-brown"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-cherry-brown mb-1.5" style={{ fontFamily: 'Raleway, sans-serif' }}>
              Confirmer le mot de passe
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-input-border focus:ring-2 focus:ring-silver-blue/20 focus:border-silver-blue transition-all outline-none text-sm"
            />
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 text-destructive bg-destructive-bg p-3 rounded-lg text-sm border border-destructive/10">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{errorMessage}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-silver-blue text-white rounded-xl font-semibold hover:bg-silver-blue-hover transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Activer mon compte'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-beige-skin/20 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-silver-blue animate-spin" />
      </div>
    }>
      <ActivateContent />
    </Suspense>
  );
}
