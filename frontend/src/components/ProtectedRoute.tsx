import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { ShieldAlert, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  onNavigateLogin?: () => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  onNavigateLogin,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <p className="mt-3 text-sm font-medium">Verifying authorization...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    if (onNavigateLogin) {
      onNavigateLogin();
      return null;
    }
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center text-slate-300">
        <ShieldAlert className="h-12 w-12 text-amber-500 mb-3" />
        <h2 className="text-xl font-semibold text-slate-100">Authentication Required</h2>
        <p className="mt-2 text-sm text-slate-400 max-w-md">
          You must be signed in to access the SURYA Operations Platform.
        </p>
      </div>
    );
  }

  if (requiredRole) {
    const roleHierarchy: Record<UserRole, number> = {
      admin: 3,
      operator: 2,
      viewer: 1,
    };

    const userLevel = roleHierarchy[user.role] ?? 0;
    const requiredLevel = roleHierarchy[requiredRole] ?? 1;

    if (userLevel < requiredLevel) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center text-slate-300">
          <div className="rounded-2xl border border-red-500/20 bg-red-950/30 p-8 max-w-md">
            <ShieldAlert className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-red-200">Access Restricted</h2>
            <p className="mt-2 text-sm text-slate-400">
              This action requires <b>{requiredRole.toUpperCase()}</b> privileges. Your current role is <b>{user.role.toUpperCase()}</b>.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};
