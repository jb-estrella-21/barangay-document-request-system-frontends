import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, changePassword as changePasswordApi, getMe, login as loginApi, logout as logoutApi, setCsrfToken, type Staff } from './api';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unavailable';
type AuthValue = {
  staff: Staff | null;
  status: AuthStatus;
  restoreError: unknown;
  logoutError: unknown;
  signingOut: boolean;
  retryRestore: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [restoreError, setRestoreError] = useState<unknown>(null);
  const [logoutError, setLogoutError] = useState<unknown>(null);
  const [signingOut, setSigningOut] = useState(false);

  const clearSession = useCallback(() => {
    setStaff(null);
    setCsrfToken(null);
    setStatus('anonymous');
  }, []);

  const retryRestore = useCallback(async () => {
    setStatus('loading');
    setRestoreError(null);
    try {
      const { data } = await getMe();
      setStaff(data.staff);
      setCsrfToken(data.csrfToken);
      setStatus('authenticated');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        clearSession();
      } else {
        setRestoreError(cause);
        setStatus('unavailable');
      }
    }
  }, [clearSession]);

  useEffect(() => {
    const expire = () => {
      clearSession();
      setRestoreError(null);
      setLogoutError(null);
    };
    window.addEventListener('staff-session-expired', expire);
    const restoreTimer = window.setTimeout(() => void retryRestore(), 0);
    return () => { window.clearTimeout(restoreTimer); window.removeEventListener('staff-session-expired', expire); };
  }, [clearSession, retryRestore]);

  const signIn = useCallback(async (username: string, password: string) => {
    setRestoreError(null);
    setLogoutError(null);
    try {
      const { data } = await loginApi(username, password);
      setStaff(data.staff);
      setCsrfToken(data.csrfToken);
      setStatus('authenticated');
    } catch (cause) {
      setStatus('anonymous');
      throw cause;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!staff || signingOut) return;
    setSigningOut(true);
    setLogoutError(null);
    try {
      await logoutApi();
      clearSession();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        clearSession();
      } else {
        setLogoutError(cause);
        try {
          const { data } = await getMe();
          setStaff(data.staff);
          setCsrfToken(data.csrfToken);
          setStatus('authenticated');
        } catch (reconcileError) {
          if (reconcileError instanceof ApiError && reconcileError.status === 401) clearSession();
          // An unavailable reconciliation preserves the existing staff view and CSRF token.
        }
      }
    } finally {
      setSigningOut(false);
    }
  }, [clearSession, signingOut, staff]);

  const updatePassword = useCallback(async (current: string, next: string) => {
    await changePasswordApi(current, next);
    setStaff((value) => value ? { ...value, mustChangePassword: false } : value);
  }, []);

  const value = useMemo(() => ({ staff, status, restoreError, logoutError, signingOut, retryRestore, signIn, signOut, changePassword: updatePassword }), [staff, status, restoreError, logoutError, signingOut, retryRestore, signIn, signOut, updatePassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
