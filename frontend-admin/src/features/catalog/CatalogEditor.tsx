import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createDocumentType, getStaffCatalog, updateDocumentType, type CreateDocumentTypeBody, type DocumentType, type FieldDefinition, type UpdateDocumentTypeBody } from '../../api';
import { Field, Loading, Notice } from '../../components/ui';
import { errorMessage } from '../../lib/presentation';

type EditorField = FieldDefinition & { optionsText: string };

export default function CatalogEditor() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { t } = useTranslation();
  const catalogQuery = useQuery({ queryKey: ['staff-catalog'], queryFn: async () => (await getStaffCatalog()).data, enabled: editing });
  const existing = catalogQuery.data?.find((entry) => entry.id === id);

  if (!editing) return <CatalogEditorForm key="new-document" />;
  if (catalogQuery.isLoading) return <section className="page-wrap"><Loading /></section>;
  if (catalogQuery.isError || !existing) {
    return <section className="page-wrap"><Notice kind="error">{errorMessage(catalogQuery.error, t('loadError'))}{' '}
      <button className="link-button" onClick={() => void catalogQuery.refetch()}>{t('retry')}</button>
    </Notice><Link to="/catalog">{t('back')}</Link></section>;
  }

  // The key changes only when the document identity changes. Background query refreshes
  // update the source object without replacing an editor's unsaved draft.
  return <CatalogEditorForm key={existing.id} existing={existing} />;
}

function CatalogEditorForm({ existing }: { existing?: DocumentType }) {
  const editing = Boolean(existing);
  const { t } = useTranslation();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [slug, setSlug] = useState(() => existing?.slug ?? '');
  const [name, setName] = useState(() => existing?.name ?? '');
  const [description, setDescription] = useState(() => existing?.description ?? '');
  const [requirements, setRequirements] = useState(() => existing?.requirements.join('\n') ?? '');
  const [fields, setFields] = useState<EditorField[]>(() => existing?.fields.map((field) => ({ ...field, optionsText: (field.options || []).join('\n') })) ?? []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const updateField = (index: number, patch: Partial<EditorField>) => setFields((old) => old.map((field, i) => i === index ? { ...field, ...patch } : field));
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const cleanFields: FieldDefinition[] = fields.map(({ optionsText, ...field }) => ({
      ...field,
      options: field.type === 'select' ? optionsText.split('\n').map((value) => value.trim()).filter(Boolean) : undefined,
    }));
    const shared = {
      name: name.trim(),
      description: description.trim(),
      requirements: requirements.split('\n').map((item) => item.trim()).filter(Boolean),
      fields: cleanFields,
    };
    try {
      if (existing) {
        const body: UpdateDocumentTypeBody = shared;
        await updateDocumentType(existing.id, body);
      } else {
        const body: CreateDocumentTypeBody = { ...shared, slug };
        await createDocumentType(body);
      }
      await cache.invalidateQueries({ queryKey: ['staff-catalog'] });
      navigate('/catalog');
    } catch (cause) {
      setError(errorMessage(cause, t('saveError')));
    } finally {
      setBusy(false);
    }
  };

  return <section className="page-wrap"><Link className="back-link" to="/catalog">← {t('catalogTitle')}</Link><div className="page-title"><div className="eyebrow">ADMINISTRATION</div><h1>{editing ? t('edit') : t('addDocument')}</h1><p>{editing ? t('versionNote') : t('catalogIntro')}</p></div><form className="panel editor-form" onSubmit={(event) => void save(event)}>{!editing && <Field label={t('slug')} hint="Lowercase letters, numbers, and hyphens"><input value={slug} onChange={(event) => setSlug(event.target.value)} required maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></Field>}<Field label={t('name')}><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} /></Field><Field label={t('description')}><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} /></Field><Field label={t('requirements')} hint={t('requirementsHint')}><textarea value={requirements} onChange={(event) => setRequirements(event.target.value)} rows={4} /></Field><div className="fields-head"><div><h2>{t('fields')}</h2><p>{t('dynamicHelp')}</p></div><button className="button outline" type="button" onClick={() => setFields((old) => [...old, { key: `field_${old.length + 1}`, label: '', type: 'text', required: false, optionsText: '' }])}>＋ {t('addField')}</button></div>{fields.map((field, index) => <div className="field-editor" key={`${index}-${field.key}`}><div className="field-editor-grid"><Field label={t('fieldKey')}><input value={field.key} pattern="[a-z][a-z0-9_]{0,39}" onChange={(event) => updateField(index, { key: event.target.value })} required maxLength={40} /></Field><Field label={t('fieldLabel')}><input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} required maxLength={100} /></Field><Field label={t('fieldType')}><select value={field.type} onChange={(event) => updateField(index, { type: event.target.value as EditorField['type'] })}><option value="text">{t('text')}</option><option value="date">{t('dateField')}</option><option value="select">{t('select')}</option></select></Field><label className="check-control field-required"><input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} />{t('required')}</label></div>{field.type === 'select' && <Field label={t('options')} hint={t('optionsHint')}><textarea value={field.optionsText} onChange={(event) => updateField(index, { optionsText: event.target.value })} rows={3} /></Field>}<button className="remove-button" type="button" onClick={() => setFields((old) => old.filter((_, i) => i !== index))}>× Remove</button></div>)}{error && <Notice kind="error">{error}</Notice>}<div className="form-footer"><button className="button primary" disabled={busy}>{busy ? t('saving') : editing ? t('save') : t('create')}</button><button className="button ghost" type="button" onClick={() => navigate('/catalog')}>{t('cancel')}</button></div></form></section>;
}

