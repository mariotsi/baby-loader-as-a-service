#!/usr/bin/env node
// Moves every Site to the current Site settings shape and lists what still breaks a rule.
// Run: node --env-file=.env.local scripts/migrate-site-settings.mjs           (dry run: prints the plan)
//      node --env-file=.env.local scripts/migrate-site-settings.mjs --apply   (creates the indexes, then writes)
// It works on databaseName(process.env) in MONGODB_URI and is safe to rerun:
// a Site already in the current shape needs no change.

import { MongoClient } from 'mongodb';
import { databaseName } from '../src/lib/dbName.ts';
import { ensureIndexes } from '../src/lib/indexes.ts';
import { defaultSiteSettings, parseSiteSettings } from '../src/lib/siteSettings.ts';
import { isFontId, isPaletteId } from '../src/lib/theme.ts';

const LEGACY_BIRTH_FIELDS = ['birthDatetime', 'weight', 'lengthCm', 'birthMessage', 'birthMessageEn'];
const SETTINGS_FIELDS = Object.keys(defaultSiteSettings);

/** `birthMessage` is the Site's primary message: Italian, unless the Site speaks English only. */
function birthFrom(doc) {
  if (!doc.birthDatetime) {
    return { born: false, details: null };
  }
  const message = {};
  if (doc.birthMessage) {
    message[doc.language === 'en' ? 'en' : 'it'] = doc.birthMessage;
  }
  if (doc.birthMessageEn) {
    message.en = doc.birthMessageEn;
  }
  return {
    born: true,
    details: {
      datetime: new Date(doc.birthDatetime).toISOString(),
      weightGrams: typeof doc.weight === 'number' ? Math.round(doc.weight) : null,
      lengthCm: typeof doc.lengthCm === 'number' ? doc.lengthCm : null,
      message,
    },
  };
}

/** The $set and $unset that bring one Site to the current shape. */
function planFor(doc) {
  const set = {};
  const unset = {};
  if (!doc.birth) {
    set.birth = birthFrom(doc);
  }
  for (const field of LEGACY_BIRTH_FIELDS) {
    if (field in doc) {
      unset[field] = '';
    }
  }
  for (const field of SETTINGS_FIELDS) {
    if (!(field in doc) && !(field in set)) {
      set[field] = defaultSiteSettings[field];
    }
  }
  if (doc.theme && !isPaletteId(doc.theme.palette)) {
    set['theme.palette'] = defaultSiteSettings.theme.palette;
  }
  if (doc.theme && !isFontId(doc.theme.font)) {
    set['theme.font'] = defaultSiteSettings.theme.font;
  }
  for (const flag of ['showName', 'showSex']) {
    if (doc.privacy && typeof doc.privacy[flag] !== 'boolean') {
      set[`privacy.${flag}`] = defaultSiteSettings.privacy[flag];
    }
  }
  return { set, unset };
}

function applyInMemory(doc, { set, unset }) {
  const next = structuredClone(doc);
  for (const field of Object.keys(unset)) {
    delete next[field];
  }
  for (const [path, value] of Object.entries(set)) {
    const [head, tail] = path.split('.');
    if (tail) {
      next[head] = { ...next[head], [tail]: value };
    } else {
      next[head] = value;
    }
  }
  return next;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  const dbName = databaseName(process.env);
  const client = await new MongoClient(uri).connect();
  try {
    const db = client.db(dbName);
    console.log(`${apply ? 'Migrating' : 'Dry run on'} ${dbName} at ${new URL(uri).host}`);
    if (apply) {
      await ensureIndexes(db);
      console.log('Indexes ready.');
    }

    const sites = await db.collection('tenants').find().toArray();
    const writes = [];
    const needsManualFix = [];
    for (const doc of sites) {
      const plan = planFor(doc);
      const changed = Object.keys(plan.set).length + Object.keys(plan.unset).length > 0;
      if (changed) {
        console.log(`${doc.slug}: set ${Object.keys(plan.set).join(', ') || '-'}; unset ${Object.keys(plan.unset).join(', ') || '-'}`);
        const update = {};
        if (Object.keys(plan.set).length) {
          update.$set = plan.set;
        }
        if (Object.keys(plan.unset).length) {
          update.$unset = plan.unset;
        }
        writes.push({ updateOne: { filter: { _id: doc._id }, update } });
      }
      const migrated = applyInMemory(doc, plan);
      const settings = Object.fromEntries(SETTINGS_FIELDS.map((field) => [field, migrated[field]]));
      const result = parseSiteSettings(settings);
      if (!result.ok) {
        needsManualFix.push(`${doc.slug}: ${result.errors.map((e) => `${e.path} ${e.code}`).join(', ')}`);
      }
    }

    if (apply && writes.length) {
      await db.collection('tenants').bulkWrite(writes);
    }
    console.log(`${sites.length} Sites, ${writes.length} ${apply ? 'migrated' : 'to migrate'}.`);
    if (needsManualFix.length) {
      console.log(`Needing a manual fix (${needsManualFix.length}):`);
      for (const line of needsManualFix) {
        console.log(`  ${line}`);
      }
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
