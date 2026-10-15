import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { setCsrfToken } from '../api';

afterEach(() => {
  cleanup();
  setCsrfToken(null);
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
