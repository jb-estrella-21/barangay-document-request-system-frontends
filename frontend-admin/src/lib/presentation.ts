import { ApiError } from '../api';
import i18n from '../i18n';

export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const tr = (key: string, options?: Record<string, unknown>) => String(i18n.t(key, options));
  const message = error.incorrectCurrentPassword ? tr('wrongCurrentPassword')
    : error.kind === 'network' ? tr('networkError')
      : error.kind === 'timeout' ? tr('timeoutError')
        : error.kind === 'invalid-response' ? tr('invalidResponse')
          : error.status === 400 ? tr('validationError')
            : error.status === 401 ? tr('loginRequired')
              : error.status === 403 ? tr('forbiddenError')
                : error.status === 404 ? tr('notFoundError')
                  : error.status === 409 ? tr('conflictError')
                    : error.status === 413 ? tr('payloadTooLarge')
                      : error.status === 428 ? tr('preconditionError')
                        : error.status === 429 ? error.retryAfterSeconds === undefined ? tr('rateLimitGeneric') : tr('rateLimit', { seconds: error.retryAfterSeconds })
                          : error.status >= 500 ? tr('serverError') : fallback;
  return error.requestId ? `${message} ${tr('supportRequestId', { id: error.requestId })}` : message;
}

export function pretty(value: unknown) {
  return value == null ? '—' : JSON.stringify(value, null, 2);
}

export function dateOnly(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00+08:00`);
  return new Intl.DateTimeFormat(i18n.language.startsWith('fil') ? 'fil-PH' : 'en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(date);
}

export function dateTime(value: string) {
  return new Intl.DateTimeFormat(i18n.language.startsWith('fil') ? 'fil-PH' : 'en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value));
}

export function todayManila() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
