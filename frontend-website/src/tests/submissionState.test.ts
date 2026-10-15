import { describe, expect, it, vi } from 'vitest';
import { CONFIRMATION_HANDOFF_TTL_MS, getConfirmationHandoff, isSubmissionReplayExpired, markSubmissionUncertain, setConfirmationHandoff, SUBMISSION_REPLAY_WINDOW_MS } from '../submissionState';

describe('resident submission state privacy', () => {
  it('persists only an uncertainty timestamp, never the payload or idempotency key', () => {
    const createdAt = Date.now();
    markSubmissionUncertain(createdAt);
    const stored = window.sessionStorage.getItem('barangay-public-submission-uncertain-v1');
    expect(stored).toBe(JSON.stringify({ createdAt }));
    expect(stored).not.toContain('applicant');
    expect(stored).not.toContain('trackingCredential');
    expect(stored).not.toContain('private-key');
  });

  it('keeps the confirmation in memory until its ten-minute expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T00:00:00Z'));
    const result = { reference: 'REQ-12345678', trackingCredential: 'private-tracking-credential', message: 'submitted' };
    setConfirmationHandoff(result, 'Certificate');
    expect(getConfirmationHandoff()).toMatchObject({ result, documentName: 'Certificate' });
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
    vi.advanceTimersByTime(CONFIRMATION_HANDOFF_TTL_MS);
    expect(getConfirmationHandoff()).toBeNull();
  });

  it('expires same-key replay at the backend retention boundary', () => {
    const createdAt = 1_000_000;
    expect(isSubmissionReplayExpired(createdAt, createdAt + SUBMISSION_REPLAY_WINDOW_MS - 1)).toBe(false);
    expect(isSubmissionReplayExpired(createdAt, createdAt + SUBMISSION_REPLAY_WINDOW_MS)).toBe(true);
  });
});
