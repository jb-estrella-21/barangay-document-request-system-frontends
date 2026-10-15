import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Status } from '../api';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="form-field"><span>{label}{hint && <small>{hint}</small>}</span>{children}</label>;
}

export function PanelTitle({ title, aside }: { title: string; aside?: string }) {
  return <div className="panel-title"><h2>{title}</h2>{aside && <span>{aside}</span>}</div>;
}

export function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`info-block ${wide ? 'wide' : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

export function StatusPill({ status }: { status: Status }) {
  const { t } = useTranslation();
  return <span className={`status-pill status-${status.toLowerCase()}`}><i />{t(`status_${status}`)}</span>;
}

export function Notice({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  return <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export function Loading() {
  const { t } = useTranslation();
  return <div className="loading-state"><span className="spinner" />{t('loading')}</div>;
}
