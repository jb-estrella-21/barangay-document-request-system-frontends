import type { SubmissionResult } from './api';

const UNCERTAINTY_STORAGE_KEY = 'barangay-public-submission-uncertain-v1';
export const SUBMISSION_REPLAY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const CONFIRMATION_HANDOFF_TTL_MS = 10 * 60 * 1000;

export type PendingSubmission = {
  body: string;
  key: string;
  createdAt: number;
  status: 'sending' | 'uncertain' | 'expired';
};

export type ConfirmationHandoff = {
  result: SubmissionResult;
  documentName: string;
  expiresAt: number;
};

type SubmissionSnapshot = {
  pending: PendingSubmission | null;
  handoff: ConfirmationHandoff | null;
  uncertainAt: number | null;
};

function readMarker(): number | null {
  try {
    const raw = window.sessionStorage.getItem(UNCERTAINTY_STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && 'createdAt' in value && typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)) return value.createdAt;
    window.sessionStorage.removeItem(UNCERTAINTY_STORAGE_KEY);
  } catch { /* Storage can be disabled; the in-memory recovery path remains available. */ }
  return null;
}

let snapshot: SubmissionSnapshot = { pending: null, handoff: null, uncertainAt: readMarker() };
let handoffTimer: number | undefined;
const listeners = new Set<() => void>();

function publish(next: SubmissionSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function subscribeSubmissionState(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSubmissionSnapshot() { return snapshot; }
export function submissionTimestamp() { return Date.now(); }
export function isSubmissionReplayExpired(createdAt: number, now = submissionTimestamp()) { return now - createdAt >= SUBMISSION_REPLAY_WINDOW_MS; }

export function setPendingSubmission(pending: PendingSubmission | null) {
  publish({ ...snapshot, pending });
}

export function markSubmissionUncertain(createdAt: number) {
  try { window.sessionStorage.setItem(UNCERTAINTY_STORAGE_KEY, JSON.stringify({ createdAt })); } catch { /* Continue without persistent recovery if browser storage is unavailable. */ }
  publish({ ...snapshot, uncertainAt: createdAt });
}

export function clearSubmissionUncertainty() {
  try { window.sessionStorage.removeItem(UNCERTAINTY_STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
  publish({ ...snapshot, uncertainAt: null });
}

export function setConfirmationHandoff(result: SubmissionResult, documentName: string, now = submissionTimestamp()) {
  if (handoffTimer !== undefined) window.clearTimeout(handoffTimer);
  const handoff = { result, documentName, expiresAt: now + CONFIRMATION_HANDOFF_TTL_MS };
  publish({ ...snapshot, handoff });
  handoffTimer = window.setTimeout(() => {
    handoffTimer = undefined;
    if (snapshot.handoff?.expiresAt === handoff.expiresAt) publish({ ...snapshot, handoff: null });
  }, CONFIRMATION_HANDOFF_TTL_MS);
}

export function getConfirmationHandoff(now = submissionTimestamp()): ConfirmationHandoff | null {
  if (snapshot.handoff && snapshot.handoff.expiresAt <= now) {
    if (handoffTimer !== undefined) window.clearTimeout(handoffTimer);
    handoffTimer = undefined;
    publish({ ...snapshot, handoff: null });
    return null;
  }
  return snapshot.handoff;
}

export function clearSubmissionMemory() {
  if (handoffTimer !== undefined) window.clearTimeout(handoffTimer);
  handoffTimer = undefined;
  publish({ ...snapshot, pending: null, handoff: null });
  clearSubmissionUncertainty();
}
