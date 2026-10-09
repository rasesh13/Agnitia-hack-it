import React, { useEffect, useRef, useState } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GSI_SCRIPT = 'https://accounts.google.com/gsi/client';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

let scriptPromise: Promise<void> | null = null;

/** Loads Google Identity Services once per page. */
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SCRIPT;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Could not load Google Sign-In'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

interface GoogleSignInButtonProps {
  /** Receives the Google ID token (JWT) to exchange with the SURYA backend. */
  onCredential: (idToken: string) => void;
  text?: 'continue_with' | 'signin_with' | 'signup_with';
}

/** "Continue with Google" button; renders nothing when no client ID is configured. */
export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onCredential, text = 'continue_with' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [failed, setFailed] = useState(false);
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        const container = containerRef.current;
        const accounts = window.google?.accounts.id;
        if (cancelled || !container || !accounts) return;
        accounts.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => callbackRef.current(response.credential),
          ux_mode: 'popup',
          cancel_on_tap_outside: true,
        });
        container.innerHTML = '';
        accounts.renderButton(container, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'center',
          width: Math.min(container.offsetWidth || 360, 400),
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!GOOGLE_CLIENT_ID) return null;
  if (failed) {
    return <p className="text-center text-[11px] text-slate-500">Google sign-in is unavailable right now.</p>;
  }
  return <div ref={containerRef} className="flex min-h-[44px] w-full justify-center" />;
};
