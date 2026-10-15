import { createContext } from 'react';
import type { StaffSessionIdentity } from '../api';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unavailable';

export type AuthValue = {
  staff: StaffSessionIdentity | null;
  status: AuthStatus;
  restoreError: unknown;
  logoutError: unknown;
  signingOut: boolean;
  retryRestore: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
};

export const AuthContext = createContext<AuthValue | null>(null);
