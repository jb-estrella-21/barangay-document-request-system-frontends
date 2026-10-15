import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { type FieldPath, type Resolver, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { ApiError, listDocumentTypes, formatManilaDate, formatManilaDateTime, submitRequest, trackRequest } from './api';
import type { DocumentType, FieldDefinition, TrackedRequest } from './api';
import { clearSubmissionUncertainty, getConfirmationHandoff, getSubmissionSnapshot, isSubmissionReplayExpired, markSubmissionUncertain, setConfirmationHandoff, setPendingSubmission, submissionTimestamp, subscribeSubmissionState, type PendingSubmission } from './submissionState';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><SiteShell /></BrowserRouter></QueryClientProvider>;
}

function SiteShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    document.getElementById('main-content')?.focus();
  }, [location.pathname]);
  const toggleLanguage = () => { void i18n.changeLanguage(i18n.language.startsWith('fil') ? 'en' : 'fil'); };
  return <div className="site-frame">
    <a className="skip-link" href="#main-content">{t('skipToMain')}</a>
    <header className="site-header">
      <Link className="brand" to="/">
        <span className="brand-mark" aria-hidden="true">B</span>
        <span><strong>{t('brand')}</strong><small>{t('tagline')}</small></span>
      </Link>
      <nav className="main-nav" aria-label={t('mainNavigation')}>
        <NavLink to="/" end>{t('navHome')}</NavLink><NavLink to="/documents">{t('navDocuments')}</NavLink><NavLink to="/track">{t('navTrack')}</NavLink>
      </nav>
      <button className="language-button" type="button" onClick={toggleLanguage}><span className="visually-hidden">{t('switchLanguage')}: </span><span aria-hidden="true">文</span>{t('language')}</button>
    </header>
    <main id="main-content" tabIndex={-1}><Routes>
      <Route path="/" element={<HomePage />} /><Route path="/documents" element={<CatalogPage />} /><Route path="/documents/:slug" element={<DocumentPage />} />
      <Route path="/request/:slug" element={<RequestPage />} /><Route path="/request/submitted" element={<ConfirmationPage />} />
      <Route path="/track" element={<TrackPage />} /><Route path="/track/result" element={<TrackResultPage />} /><Route path="*" element={<NotFoundPage />} />
    </Routes></main>
    <footer className="site-footer"><div className="footer-inner"><div><strong>{t('footer')}</strong><p>{t('footerNote')}</p></div><span aria-hidden="true">●</span></div></footer>
  </div>;
}

function useCatalog() { return useQuery({ queryKey: ['public-document-types'], queryFn: listDocumentTypes }); }

function HomePage() {
  const { t } = useTranslation();
  const catalog = useCatalog();
  return <>
    <section className="hero-wrap">
      <div className="hero-copy"><div className="eyebrow"><span />{t('eyebrow')}</div><h1>{t('heroTitle')}</h1><p className="hero-lede">{t('heroText')}</p>
        <div className="hero-actions"><Link className="button button-primary" to="/documents">{t('browse')} <span aria-hidden="true">→</span></Link><Link className="button button-outline" to="/track">{t('track')}</Link></div>
        <div className="catalog-count" role={catalog.isError ? 'alert' : undefined}>{catalog.isLoading ? t('loading') : catalog.isError ? apiErrorMessage(catalog.error, t, 'loadError') : catalog.data ? t('documentCount', { count: catalog.data.length }) : ''}</div>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="paper paper-back"><i /><i /><i /></div><div className="paper paper-front"><span className="seal">B</span><div className="paper-lines"><i /><i /><i /><i /></div><div className="paper-stamp">BARANGAY<br />DOCUMENT</div></div><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="leaf leaf-one" /><div className="leaf leaf-two" /></div>
    </section>
    <section className="steps-section content-width"><div className="section-heading"><div><div className="eyebrow">{t('eyebrow')}</div><h2>{t('browse')}</h2></div><Link className="text-link" to="/documents">{t('browseTitle')} <span aria-hidden="true">→</span></Link></div>
      <div className="steps-grid"><Step number="01" title={t('homeStep1')} description={t('homeStep1Text')} /><Step number="02" title={t('homeStep2')} description={t('homeStep2Text')} /><Step number="03" title={t('homeStep3')} description={t('homeStep3Text')} /></div>
    </section>
    <section className="home-note content-width"><div className="note-icon" aria-hidden="true">✳</div><div><strong>{t('serverReference')}</strong><p>{t('progressPrivate')}</p></div><Link className="text-link" to="/track">{t('track')} →</Link></section>
  </>;
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return <article className="step-card"><span className="step-number">{number}</span><h3>{title}</h3><p>{description}</p></article>;
}

function CatalogPage() {
  const { t } = useTranslation();
  const { data, error, isLoading, isError, refetch } = useCatalog();
  return <section className="page-section content-width"><PageHeading eyebrow={t('eyebrow')} title={t('browseTitle')} description={t('browseIntro')} />
    {isLoading && <Loading />}{isError && <ErrorPanel message={apiErrorMessage(error, t, 'loadError')} retry={() => void refetch()} />}
    {!isLoading && !isError && data?.length === 0 && <EmptyPanel>{t('emptyCatalog')}</EmptyPanel>}
    {!!data?.length && <div className="document-grid">{data.map((document) => <DocumentCard key={document.id} document={document} />)}</div>}
  </section>;
}

function DocumentCard({ document }: { document: DocumentType }) {
  const { t } = useTranslation();
  return <article className="document-card"><div className="document-symbol" aria-hidden="true">▧</div><span className="card-kicker">{t('navDocuments')}</span>
    <h2>{document.name}</h2><p>{document.description || t('dynamicHelp')}</p><div className="requirement-count">{document.requirements.length} {t('requirements').toLowerCase()}</div>
    <Link className="card-link" to={`/documents/${encodeURIComponent(document.slug)}`}>{t('startRequest')} <span aria-hidden="true">→</span></Link>
  </article>;
}

function DocumentPage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const catalog = useCatalog();
  const document = catalog.data?.find((item) => item.slug === slug);
  if (catalog.isLoading) return <section className="page-section content-width"><Loading /></section>;
  if (catalog.isError) return <section className="page-section content-width"><ErrorPanel message={apiErrorMessage(catalog.error, t, 'loadError')} retry={() => void catalog.refetch()} /></section>;
  if (!document) return <section className="page-section content-width"><EmptyPanel>{t('documentNotFound')} <Link to="/documents">{t('backDocuments')}</Link></EmptyPanel></section>;
  return <section className="page-section content-width"><Link className="back-link" to="/documents">← {t('backDocuments')}</Link>
    <div className="detail-layout"><article className="detail-main"><div className="eyebrow">{t('navDocuments')}</div><h1>{document.name}</h1><p className="detail-lede">{document.description}</p>
      <h2>{t('requirements')}</h2>{document.requirements.length ? <ul className="requirement-list">{document.requirements.map((item, index) => <li key={`${item}-${index}`}><span aria-hidden="true">✓</span>{item}</li>)}</ul> : <p className="muted">{t('dynamicHelp')}</p>}
    </article><aside className="detail-aside"><div className="aside-icon" aria-hidden="true">✳</div><h2>{t('startRequest')}</h2><p>{t('submitHelp')}</p><Link className="button button-primary full-button" to={`/request/${encodeURIComponent(document.slug)}`}>{t('startRequest')} <span aria-hidden="true">→</span></Link></aside></div>
  </section>;
}

type RequestValues = { applicant: { fullName: string; contactNumber: string; address: string }; fields: Record<string, string> };

export function RequestPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const catalog = useCatalog();
  const document = catalog.data?.find((item) => item.slug === slug);
  const submissionState = useSyncExternalStore(subscribeSubmissionState, getSubmissionSnapshot, getSubmissionSnapshot);
  const [apiMessage, setApiMessage] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [now, setNow] = useState(0);
  const schema = useMemo(() => z.object({
    applicant: z.object({
      fullName: z.string().trim().min(2, t('nameMin')).max(160, t('nameMax')),
      contactNumber: z.string().trim().min(7, t('contactInvalid')).max(40, t('contactInvalid')).regex(/^(?=.*\d)[+0-9() .-]+$/, t('contactInvalid')),
      address: z.string().trim().min(3, t('addressInvalid')).max(500, t('addressInvalid')),
    }),
    fields: z.record(z.string(), z.string()),
  }), [t]);
  const form = useForm<RequestValues>({ resolver: zodResolver(schema) as Resolver<RequestValues>, defaultValues: { applicant: { fullName: '', contactNumber: '', address: '' }, fields: {} } });
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError, reset } = form;

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(submissionTimestamp()), 0);
    const timer = window.setInterval(() => setNow(submissionTimestamp()), 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  const sendAttempt = async (attempt: PendingSubmission) => {
    if (!document) return;
    if (attempt.status === 'expired' || isSubmissionReplayExpired(attempt.createdAt)) {
      setPendingSubmission({ ...attempt, status: 'expired' });
      markSubmissionUncertain(attempt.createdAt);
      setApiMessage(t('submissionReplayExpired'));
      return;
    }
    const sending = { ...attempt, status: 'sending' as const };
    setPendingSubmission(sending);
    setApiMessage('');
    try {
      const result = await submitRequest(attempt.body, attempt.key);
      setPendingSubmission(null);
      clearSubmissionUncertainty();
      setConfirmationHandoff(result, document.name);
      navigate('/request/submitted');
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      const outcomeUncertain = !apiError || apiError.kind !== 'http' || apiError.status >= 500 || apiError.status === 409;
      if (outcomeUncertain) {
        const retryExpired = isSubmissionReplayExpired(attempt.createdAt) || apiError?.code === 'IDEMPOTENCY_RESPONSE_EXPIRED';
        setPendingSubmission({ ...attempt, status: retryExpired ? 'expired' : 'uncertain' });
        markSubmissionUncertain(attempt.createdAt);
        const message = retryExpired ? t('submissionReplayExpired') : apiErrorMessage(apiError, t, 'submissionUncertain');
        setApiMessage(apiError?.requestId && retryExpired ? `${message} ${t('supportRequestId', { id: apiError.requestId })}` : message);
        return;
      }

      setPendingSubmission(null);
      clearSubmissionUncertainty();
      if (apiError?.status === 400) {
        const allowedPaths = new Set(['applicant.fullName', 'applicant.contactNumber', 'applicant.address', ...document.fields.map((field) => `fields.${field.key}`)]);
        apiError.errors.filter((path) => allowedPaths.has(path)).forEach((path) => {
          setError(path as FieldPath<RequestValues>, { type: 'server', message: t('serverValidation') });
        });
      }
      setApiMessage(apiErrorMessage(apiError, t, 'formError'));
    }
  };

  const submit = async (values: RequestValues) => {
    if (!document || submissionState.pending || submissionState.uncertainAt !== null) return;
    setApiMessage('');
    let invalid = false;
    for (const field of document.fields) {
      const value = (values.fields[field.key] ?? '').trim();
      let issue = '';
      if (field.required && !value) issue = t('dynamicRequired', { label: field.label });
      else if (value.length > 1000) issue = t('dynamicMax', { label: field.label });
      else if (field.type === 'date' && value && !isValidDateOnly(value)) issue = t('dynamicDate', { label: field.label });
      else if (field.type === 'select' && value && !field.options?.includes(value)) issue = t('dynamicOption', { label: field.label });
      if (issue) { setError(`fields.${field.key}` as FieldPath<RequestValues>, { type: 'validate', message: issue }); invalid = true; }
    }
    if (invalid) return;
    const payload = { documentTypeId: document.id, applicant: values.applicant, fields: values.fields };
    const attempt: PendingSubmission = { body: JSON.stringify(payload), key: crypto.randomUUID(), createdAt: submissionTimestamp(), status: 'sending' };
    setPendingSubmission(attempt);
    await sendAttempt(attempt);
  };

  const retryUncertainSubmission = async () => {
    const attempt = submissionState.pending;
    if (!attempt || attempt.status === 'sending') return;
    setRetrying(true);
    try { await sendAttempt(attempt); } finally { setRetrying(false); }
  };

  const startNewSubmission = () => {
    setPendingSubmission(null);
    clearSubmissionUncertainty();
    setApiMessage('');
    reset({ applicant: { fullName: '', contactNumber: '', address: '' }, fields: {} });
  };

  const pendingExpired = !!submissionState.pending && (submissionState.pending.status === 'expired' || (now > 0 && isSubmissionReplayExpired(submissionState.pending.createdAt, now)));
  const recoveryBlocked = !!submissionState.pending || submissionState.uncertainAt !== null;
  const busy = isSubmitting || retrying || submissionState.pending?.status === 'sending';

  if (catalog.isLoading) return <section className="page-section content-width"><Loading /></section>;
  if (catalog.isError) return <section className="page-section content-width"><ErrorPanel message={apiErrorMessage(catalog.error, t, 'loadError')} retry={() => void catalog.refetch()} /></section>;
  if (!document) return <section className="page-section content-width"><EmptyPanel>{t('documentNotFound')} <Link to="/documents">{t('backDocuments')}</Link></EmptyPanel></section>;

  return <section className="page-section content-width form-page"><Link className="back-link" to={`/documents/${encodeURIComponent(document.slug)}`}>← {t('backDocuments')}</Link>
    <PageHeading eyebrow={document.name} title={t('requestTitle')} description={t('submitHelp')} />
    {recoveryBlocked && <div className="alert alert-error recovery-panel" role="alert" aria-live="assertive"><div><strong>{t('submissionUncertainTitle')}</strong><p>{submissionState.pending?.status === 'sending' ? t('submissionSending') : apiMessage || (pendingExpired ? t('submissionReplayExpired') : t('submissionUncertain'))}</p>{!submissionState.pending && <p>{t('submissionReloadWarning')}</p>}</div>
      {submissionState.pending?.status === 'uncertain' && !pendingExpired && <button className="button button-small button-outline" type="button" disabled={busy} onClick={() => void retryUncertainSubmission()}>{busy ? t('submitting') : t('retrySameSubmission')}</button>}
      {submissionState.pending?.status !== 'sending' && <button className="text-button" type="button" onClick={startNewSubmission}>{t('startNewAfterUncertain')}</button>}
    </div>}
    <form className="request-form" onSubmit={handleSubmit(submit)} noValidate>
      <fieldset className="form-card" disabled={recoveryBlocked || busy}><legend>{t('applicantDetails')}</legend>
        <FormField label={t('fullName')} error={errors.applicant?.fullName?.message}><input autoComplete="name" {...register('applicant.fullName')} /></FormField>
        <FormField label={t('contactNumber')} error={errors.applicant?.contactNumber?.message}><input type="tel" autoComplete="tel" {...register('applicant.contactNumber')} /></FormField>
        <FormField label={t('address')} error={errors.applicant?.address?.message}><textarea rows={3} autoComplete="street-address" {...register('applicant.address')} /></FormField>
      </fieldset>
      <fieldset className="form-card" disabled={recoveryBlocked || busy}><legend>{t('yourInformation')}</legend><p className="muted">{t('dynamicHelp')}</p>
        {document.fields.length === 0 && <div className="inline-note">{t('dynamicHelp')}</div>}
        {document.fields.map((field) => <DynamicField key={field.key} field={field} register={register} error={errors.fields?.[field.key]?.message as string | undefined} />)}
      </fieldset>
      {apiMessage && !recoveryBlocked && <div className="alert alert-error" role="alert" aria-live="assertive">{apiMessage}</div>}
      <div className="form-actions"><button className="button button-primary" type="submit" disabled={busy || recoveryBlocked}>{busy ? t('submitting') : t('submit')} <span aria-hidden="true">→</span></button><span>{t('submitHelp')}</span></div>
    </form>
  </section>;
}

function DynamicField({ field, register, error }: { field: FieldDefinition; register: ReturnType<typeof useForm<RequestValues>>['register']; error?: string }) {
  const { t } = useTranslation();
  const name = `fields.${field.key}` as FieldPath<RequestValues>;
  return <FormField label={<>{field.label} <span className="field-requirement">{field.required ? t('required') : t('optional')}</span></>} error={error}>
    {field.type === 'select' ? <select defaultValue="" {...register(name)}><option value="">—</option>{(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input type={field.type === 'date' ? 'date' : 'text'} maxLength={1000} {...register(name)} />}
  </FormField>;
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

export function ConfirmationPage() {
  const { t } = useTranslation();
  const snapshot = useSyncExternalStore(subscribeSubmissionState, getSubmissionSnapshot, getSubmissionSnapshot);
  const handoff = snapshot.handoff;
  useEffect(() => {
    const checkExpiry = () => getConfirmationHandoff();
    checkExpiry();
    const timer = window.setInterval(checkExpiry, 30_000);
    window.addEventListener('focus', checkExpiry);
    document.addEventListener('visibilitychange', checkExpiry);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', checkExpiry);
      document.removeEventListener('visibilitychange', checkExpiry);
    };
  }, []);
  if (!handoff) return <section className="page-section content-width"><EmptyPanel><h1>{t('confirmationTitle')}</h1><p>{t('confirmationUnavailable')}</p><Link className="button button-primary" to="/documents">{t('browse')}</Link></EmptyPanel></section>;
  return <section className="page-section content-width confirmation-wrap"><div className="success-mark" aria-hidden="true">✓</div><div className="eyebrow">{handoff.documentName}</div><h1>{t('confirmationTitle')}</h1><p className="confirmation-intro">{t('confirmationText')}</p>
    <div className="credential-card"><Credential label={t('reference')} value={handoff.result.reference} /><Credential label={t('trackingCredential')} value={handoff.result.trackingCredential} privateValue /></div>
    <p className="save-reminder">{t('saveReminder')}</p><Link className="button button-primary" to="/track">{t('nextTrack')} <span aria-hidden="true">→</span></Link>
  </section>;
}

function Credential({ label, value, privateValue = false }: { label: string; value: string; privateValue?: boolean }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setCopyError(false); window.setTimeout(() => setCopied(false), 1800); } catch { setCopyError(true); } };
  return <div className="credential-row"><div><span>{label}</span><code className={privateValue ? 'credential-secret' : ''}>{value}</code></div><button className="button button-small button-outline" type="button" onClick={() => void copy()}>{copied ? t('copied') : t('copy')}</button>{copied && <span className="visually-hidden" role="status">{t('copied')}</span>}{copyError && <p className="field-error" role="alert">{t('copyFailed')}</p>}</div>;
}

type TrackFormValues = { reference: string; trackingCredential: string };

function TrackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [apiMessage, setApiMessage] = useState('');
  const schema = useMemo(() => z.object({ reference: z.string().trim().min(8, t('referenceInvalid')).max(32, t('referenceInvalid')), trackingCredential: z.string().min(40, t('credentialInvalid')).max(100, t('credentialInvalid')) }), [t]);
  const form = useForm<TrackFormValues>({ resolver: zodResolver(schema) as Resolver<TrackFormValues>, defaultValues: { reference: '', trackingCredential: '' } });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;
  const submit = async (values: TrackFormValues) => {
    setApiMessage('');
    try { const request = await trackRequest(values.reference.trim(), values.trackingCredential.trim()); navigate('/track/result', { state: { request } }); }
    catch (error) { setApiMessage(error instanceof ApiError && error.status === 404 ? t('trackError') : apiErrorMessage(error, t, 'formError')); }
  };
  return <section className="page-section content-width narrow-page"><PageHeading eyebrow={t('navTrack')} title={t('trackTitle')} description={t('trackText')} />
    <form className="form-card track-form" onSubmit={handleSubmit(submit)} noValidate>
      <FormField label={t('reference')} error={errors.reference?.message}><input autoComplete="off" spellCheck={false} {...register('reference')} /></FormField>
      <FormField label={t('trackingCredential')} error={errors.trackingCredential?.message}><input type="password" autoComplete="off" spellCheck={false} {...register('trackingCredential')} /></FormField>
      {apiMessage && <div className="alert alert-error" role="alert">{apiMessage}</div>}
      <button className="button button-primary full-button" type="submit" disabled={isSubmitting}>{isSubmitting ? t('checking') : t('checkProgress')} <span aria-hidden="true">→</span></button><p className="muted small-text">{t('serverReference')}</p>
    </form>
  </section>;
}

function TrackResultPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const request = (location.state as { request?: TrackedRequest } | null)?.request;
  const locale = i18n.language.startsWith('fil') ? 'fil-PH' : 'en-PH';
  if (!request) return <section className="page-section content-width"><EmptyPanel>{t('trackError')} <Link to="/track">{t('trackTitle')}</Link></EmptyPanel></section>;
  return <section className="page-section content-width narrow-page"><Link className="back-link" to="/track">← {t('trackTitle')}</Link>
    <div className="tracking-card"><div className="eyebrow">{request.reference}</div><h1>{t('trackResult')}</h1><h2>{request.documentName}</h2>
      <div className="status-banner"><span className={`status-dot status-${request.status.toLowerCase()}`} /><div><span>{t('status')}</span><strong>{t(`status_${request.status}`)}</strong></div></div>
      {request.statusMessage && <div className="public-message"><span>{t('statusMessage')}</span><p>{request.statusMessage}</p></div>}
      <dl className="tracking-dates"><div><dt>{t('submittedOn')}</dt><dd>{formatManilaDateTime(request.submittedAt, locale)}</dd></div>
        <div><dt>{t('expectedDate')}</dt><dd>{request.expectedReleaseDate ? formatManilaDate(request.expectedReleaseDate, locale) : t('noDate')}<small>{t('expectedHelp')}</small></dd></div>
        <div><dt>{t('readyAt')}</dt><dd>{request.readyAt ? formatManilaDateTime(request.readyAt, locale) : t('notReady')}</dd></div>
        <div><dt>{t('releasedAt')}</dt><dd>{request.releasedAt ? formatManilaDateTime(request.releasedAt, locale) : t('notReleased')}</dd></div></dl>
      <p className="muted small-text">{t('progressPrivate')}</p>
    </div>
  </section>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>;
}

function FormField({ label, error, children }: { label: React.ReactNode; error?: string; children: React.ReactNode }) {
  const id = React.useId();
  const control = React.isValidElement(children) ? React.cloneElement(children as React.ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>, { id, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-error` : undefined }) : children;
  return <div className="form-field"><label htmlFor={id}>{label}</label>{control}{error && <span className="field-error" id={`${id}-error`}>{error}</span>}</div>;
}

function apiErrorMessage(error: unknown, t: ReturnType<typeof useTranslation>['t'], fallbackKey: string): string {
  if (!(error instanceof ApiError)) return t(fallbackKey);
  let message: string;
  if (error.kind === 'network') message = t('networkError');
  else if (error.kind === 'timeout') message = t('timeoutError');
  else if (error.kind === 'invalid-response') message = t('invalidResponse');
  else if (error.status === 400) message = t('validationError');
  else if (error.status === 401) message = t('authenticationError');
  else if (error.status === 403) message = t('forbiddenError');
  else if (error.status === 404) message = t('requestNotFound');
  else if (error.status === 409) message = t('conflictError');
  else if (error.status === 413) message = t('payloadTooLarge');
  else if (error.status === 428) message = t('preconditionError');
  else if (error.status === 429) message = error.retryAfterSeconds === undefined ? t('rateLimitGeneric') : t('rateLimit', { seconds: error.retryAfterSeconds });
  else if (error.status >= 500) message = t('serverError');
  else message = t(fallbackKey);
  return error.requestId ? `${message} ${t('supportRequestId', { id: error.requestId })}` : message;
}

function Loading() { const { t } = useTranslation(); return <div className="loading-panel" role="status"><span className="spinner" />{t('loading')}</div>; }
function ErrorPanel({ message, retry }: { message: string; retry: () => void }) { const { t } = useTranslation(); return <div className="alert alert-error" role="alert"><span>{message}</span><button className="text-button" type="button" onClick={retry}>{t('retry')}</button></div>; }
function EmptyPanel({ children }: { children: React.ReactNode }) { return <div className="empty-panel">{children}</div>; }
function NotFoundPage() { const { t } = useTranslation(); return <section className="page-section content-width"><EmptyPanel><h1>404</h1><Link className="button button-primary" to="/">{t('homeLink')}</Link></EmptyPanel></section>; }

export default App;
