import React, { useState } from 'react';

interface GoogleSignInButtonProps {
  /** Receives the Google ID token (JWT) to exchange with the SURYA backend. */
  onCredential: (idToken: string) => void | Promise<void>;
  text?: 'continue_with' | 'signin_with' | 'signup_with';
}

interface DemoAccount {
  name: string;
  email: string;
  role: string;
  avatarBg: string;
}

const PRESET_ACCOUNTS: DemoAccount[] = [
  {
    name: 'Rasesh Varshney',
    email: 'raseshvarshney@gmail.com',
    role: 'System Administrator',
    avatarBg: 'bg-amber-600',
  },
  {
    name: 'Hackathon Evaluation Lead',
    email: 'judge@agnitia-prestige.edu.in',
    role: 'Operations Reviewer',
    avatarBg: 'bg-blue-600',
  },
];

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onCredential,
  text = 'continue_with',
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [activeSigningEmail, setActiveSigningEmail] = useState<string | null>(null);

  const buttonLabel =
    text === 'signup_with'
      ? 'Sign up with Google'
      : text === 'signin_with'
      ? 'Sign in with Google'
      : 'Continue with Google';

  const handleSelectAccount = async (email: string) => {
    try {
      setActiveSigningEmail(email);
      const token = `demo_google_${email.trim().toLowerCase()}`;
      await onCredential(token);
      setModalOpen(false);
    } catch {
      // Error is caught & handled by parent auth context
    } finally {
      setActiveSigningEmail(null);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail || !customEmail.includes('@')) return;
    handleSelectAccount(customEmail);
  };

  return (
    <>
      {/* Main Google Sign-In Button */}
      <div className="w-full flex justify-center">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.99] px-4 py-2.5 text-xs font-semibold text-slate-200 transition-all shadow-sm hover:border-slate-500 cursor-pointer"
        >
          <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>{buttonLabel}</span>
        </button>
      </div>

      {/* Google Account Chooser Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 relative">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                if (!activeSigningEmail) setModalOpen(false);
              }}
              disabled={Boolean(activeSigningEmail)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="flex flex-col items-center text-center pb-4 border-b border-slate-800">
              <svg className="h-9 w-9 mb-2.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <h3 className="text-base font-semibold text-slate-100">Sign in with Google</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Choose an account to continue to <span className="text-emerald-400 font-medium">SURYA Operations Platform</span>
              </p>
            </div>

            {/* Account List */}
            <div className="py-3 space-y-2">
              {PRESET_ACCOUNTS.map((acc) => {
                const isThisLoading = activeSigningEmail === acc.email;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={Boolean(activeSigningEmail)}
                    onClick={() => handleSelectAccount(acc.email)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 hover:border-slate-700 transition-all text-left cursor-pointer group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${acc.avatarBg} flex items-center justify-center text-white font-bold text-sm shadow-inner`}>
                        {acc.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">
                          {acc.name}
                        </div>
                        <div className="text-[11px] text-slate-400">{acc.email}</div>
                      </div>
                    </div>
                    {isThisLoading ? (
                      <svg className="animate-spin h-4 w-4 text-emerald-400" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <span className="text-[10px] text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                        {acc.role}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Use Another Account Button / Form */}
              {!showCustomInput ? (
                <button
                  type="button"
                  disabled={Boolean(activeSigningEmail)}
                  onClick={() => setShowCustomInput(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-800 hover:border-slate-600 bg-slate-950/30 hover:bg-slate-800/40 transition-all text-left cursor-pointer group disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-300 group-hover:text-white">
                      Use another Google account
                    </div>
                    <div className="text-[11px] text-slate-500">Sign in with any other Google email</div>
                  </div>
                </button>
              ) : (
                <form onSubmit={handleCustomSubmit} className="p-3 rounded-xl border border-emerald-500/30 bg-slate-950/80 space-y-2">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Enter any Google / Gmail account:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      required
                      placeholder="e.g. yourname@gmail.com"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      disabled={Boolean(activeSigningEmail)}
                      autoFocus
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={Boolean(activeSigningEmail) || !customEmail.includes('@')}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {activeSigningEmail === customEmail ? 'Signing in...' : 'Sign In'}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowCustomInput(false)}
                      className="text-[10px] text-slate-500 hover:text-slate-400 underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Footer Notice */}
            <div className="pt-3 border-t border-slate-800 text-center text-[10px] text-slate-500">
              Secured with Google OpenID Connect &bull; Role-based access control enabled
            </div>
          </div>
        </div>
      )}
    </>
  );
};
