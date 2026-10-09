import React, { useEffect, useRef, useState } from 'react';

interface GoogleSignInButtonProps {
  /** Receives the Google-issued ID token (JWT) to exchange with the SURYA backend. */
  onCredential: (idToken: string) => void | Promise<void>;
  text?: 'continue_with' | 'signin_with' | 'signup_with';
}

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityService {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
      renderButton: (parent: HTMLElement, options: { theme: 'outline'; size: 'large'; text: 'continue_with' | 'signin_with' | 'signup_with'; width: number }) => void;
    };
  };
}

declare global {
  interface Window { google?: GoogleIdentityService; }
}

const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';

function loadGoogleIdentityService(): Promise<GoogleIdentityService> {
  if (window.google) return Promise.resolve(window.google);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`);
    const script = existing ?? document.createElement('script');
    const onLoad = () => window.google ? resolve(window.google) : reject(new Error('Google Identity Services did not load.'));
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', () => reject(new Error('Google Identity Services could not be loaded.')), { once: true });
    if (!existing) {
      script.src = GOOGLE_IDENTITY_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onCredential, text = 'continue_with' }) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;
    let cancelled = false;
    loadGoogleIdentityService().then((google) => {
      if (cancelled || !buttonRef.current) return;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          if (!credential) {
            setError('Google did not return a sign-in credential. Please try again.');
            return;
          }
          try {
            setError(null);
            await onCredential(credential);
          } catch {
            // AuthContext surfaces the API error beside the form.
          }
        },
      });
      buttonRef.current.replaceChildren();
      google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline', size: 'large', text, width: Math.max(250, buttonRef.current.clientWidth),
      });
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Google sign-in could not be initialized.');
    });
    return () => { cancelled = true; };
  }, [clientId, onCredential, text]);

  if (!clientId) return <p className="text-center text-xs text-amber-300">Google sign-in is not configured yet.</p>;

  return (
    <div className="w-full">
      <div ref={buttonRef} className="flex min-h-11 w-full justify-center" />
      {error && <p className="mt-2 text-center text-xs text-red-300">{error}</p>}
    </div>
  );
};
