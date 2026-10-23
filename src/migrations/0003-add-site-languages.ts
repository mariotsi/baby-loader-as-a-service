import type { Migration } from '../lib/migrations.ts';

/** The Languages each value of the old Language mode stood for, Italian first as the Public page showed them. */
const LANGUAGES_OF_MODE = { it: ['it'], en: ['en'], both: ['it', 'en'] } as const;

/**
 * Replaces each Site's Language mode (`language: 'it' | 'en' | 'both'`) with
 * its Languages in one step. Deployments before Languages cannot read the
 * result, an exception to the rule in migrations.ts taken while production
 * has no Owners.
 */
export const addSiteLanguages: Migration = {
  id: '0003-add-site-languages',
  async up(db) {
    const sites = db.collection('sites');
    for (const [language, languages] of Object.entries(LANGUAGES_OF_MODE)) {
      await sites.updateMany({ language, languages: { $exists: false } }, { $set: { languages } });
    }
    await sites.updateMany({ language: { $exists: true } }, { $unset: { language: '' } });
  },
};
