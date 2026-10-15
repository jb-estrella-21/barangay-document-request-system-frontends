import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { clearSubmissionMemory } from '../submissionState';

afterEach(() => {
  cleanup();
  clearSubmissionMemory();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
