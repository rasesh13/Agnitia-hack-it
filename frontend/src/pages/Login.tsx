import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { SuryaMark } from '@/components/SuryaMark';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

interface LoginProps {
  onNavigateSignup: () => void;
  onNavigateLanding?: () => void;
  onSuccess?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigateSignup, onNavigateLanding, onSuccess }) => {
  const { login, loginWithGoogle, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    clearError();
    setIsSubmitting(true);
    try {
      await login(email, password);
      if (onSuccess) {
        onSuccess();
      }
    } catch {
      // Error handled in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        {/* Header Branding */}
        <div className="text-center">
          <SuryaMark size={60} className="mx-auto drop-shadow-[0_0_24px_rgba(245,158,11,0.4)]" />
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-white">
            SURYA Operations Platform
          </h2>
          <p className="mt-2 text-xs font-medium uppercase tracking-wider text-emerald-400">
            Smart Unified Renewable Yield Automation
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/40 p-3.5 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Email Address
            </label>
            <div className="relative mt-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@surya-campus.in"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 transition-all focus:border-emerald-500 focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <div className="relative mt-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-10 text-sm text-slate-100 placeholder-slate-500 transition-all focus:border-emerald-500 focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:from-emerald-500 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In to Mission Control</span>
            )}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={async () => {
              setEmail('admin@prestige.edu.in');
              setPassword('SuryaAdmin2026!');
              clearError();
              setIsSubmitting(true);
              try {
                await login('admin@prestige.edu.in', 'SuryaAdmin2026!');
                if (onSuccess) onSuccess();
              } catch {
                // handled in context
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-300 transition-all hover:bg-emerald-500/20"
          >
            ⚡ 1-Click Demo Login (Prestige University Admin)
          </button>
        </form>

        {/* Google sign-in */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span className="h-px flex-1 bg-slate-800" />
            or
            <span className="h-px flex-1 bg-slate-800" />
          </div>
          <GoogleSignInButton
            onCredential={async (idToken) => {
              clearError();
              try {
                await loginWithGoogle(idToken);
                if (onSuccess) onSuccess();
              } catch {
                // Error is shown by the auth context.
              }
            }}
          />
        </div>

        {/* Footer info */}
        <div className="pt-2 text-center text-xs text-slate-400 space-y-2">
          <div>
            <span>Need an account? </span>
            <button
              onClick={onNavigateSignup}
              className="font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
            >
              Create new account
            </button>
          </div>
          {onNavigateLanding && (
            <div>
              <button
                onClick={onNavigateLanding}
                className="text-slate-400 hover:text-amber-400 transition-colors"
              >
                ← Return to SURYA Landing Page
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
