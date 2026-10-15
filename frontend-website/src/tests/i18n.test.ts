import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n, { getInitialLanguage, languageStorageKey } from '../i18n';

describe('resident language preference', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });
  afterEach(async () => { await i18n.changeLanguage('en'); window.localStorage.clear(); });

  it('accepts only the supported stored language codes', () => {
    expect(getInitialLanguage({ getItem: () => 'fil' })).toBe('fil');
    expect(getInitialLanguage({ getItem: () => 'en' })).toBe('en');
    expect(getInitialLanguage({ getItem: () => 'es' })).toBe('en');
    expect(getInitialLanguage(null)).toBe('en');
    expect(getInitialLanguage({ getItem: () => { throw new Error('storage blocked'); } })).toBe('en');
  });

  it('persists only the language code and updates document language and metadata', async () => {
    const description = document.createElement('meta');
    description.name = 'description';
    document.head.append(description);

    await i18n.changeLanguage('fil');

    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.getItem(languageStorageKey)).toBe('fil');
    expect(document.documentElement.lang).toBe('fil');
    expect(document.title).toBe('Mga Dokumento ng Barangay');
    expect(description.content).toContain('Humiling');
    description.remove();
  });

  it('keeps English and Filipino translation keys aligned', () => {
    const resources = i18n.store.data as Record<string, { translation: Record<string, unknown> }>;
    expect(Object.keys(resources.en.translation).sort()).toEqual(Object.keys(resources.fil.translation).sort());
  });
});
