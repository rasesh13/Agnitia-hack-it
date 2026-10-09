import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserReadResponse } from '../types';
import { apiAuth, ApiError } from '../services/api';

interface AuthContextType {
  user: UserReadResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'surya_token';
const USER_KEY = 'surya_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserReadResponse | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY);
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  // Validate session against /api/v1/auth/me on mount
  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const verifiedUser = await apiAuth.getMe();
        if (isMounted) {
          setUser(verifiedUser);
          localStorage.setItem(USER_KEY, JSON.stringify(verifiedUser));
        }
      } catch (err) {
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    verifySession();

    const handleAuthExpired = () => {
      logout();
    };

    window.addEventListener('surya-auth-expired', handleAuthExpired);
    return () => {
      isMounted = false;
      window.removeEventListener('surya-auth-expired', handleAuthExpired);
    };
  }, [logout]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiAuth.login(email, password);
      localStorage.setItem(TOKEN_KEY, response.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      setToken(response.access_token);
      setUser(response.user);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Login failed. Please check credentials.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiAuth.googleAuth(idToken);
      localStorage.setItem(TOKEN_KEY, response.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      setToken(response.access_token);
      setUser(response.user);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiAuth.signup(email, password);
      localStorage.setItem(TOKEN_KEY, response.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      setToken(response.access_token);
      setUser(response.user);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Registration failed. Please check your details.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const isAuthenticated = Boolean(token && user);
  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'admin' || user?.role === 'operator';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isAdmin,
        isOperator,
        isLoading,
        error,
        login,
        signup,
        loginWithGoogle,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
