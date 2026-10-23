import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  defaultNotificationTitle,
  defaultSiteSettings,
  parseNewSite,
  parseSiteSettings,
  type SiteSettingsInput,
} from './siteSettings.ts';

const NOW = new Date('2026-10-20T12:00:00Z');

function settings(overrides: Partial<SiteSettingsInput> = {}): SiteSettingsInput {
  return { ...structuredClone(defaultSiteSettings), ...overrides };
}

function born(details: Partial<Extract<SiteSettingsInput['birth'], { born: true }>['details']> = {}) {
  return {
    born: true as const,
    details: { datetime: '2026-10-19T08:30:00.000Z', weightGrams: 3400, lengthCm: 50, message: {}, ...details },
  };
}

function errorsOf(input: unknown) {
  const result = parseSiteSettings(input, NOW);
  assert.equal(result.ok, false, 'expected the parse to fail');
  return result.ok ? [] : result.errors;
}

test('the default Site settings are valid', () => {
  assert.equal(parseSiteSettings(defaultSiteSettings, NOW).ok, true);
});

test('a Born Site with name, Sex and Birth details is valid', () => {
  const result = parseSiteSettings(settings({ babyName: 'Emma', sex: 'female', birth: born() }), NOW);
  assert.equal(result.ok, true);
});

test('the name is trimmed and capped at 60 characters', () => {
  const result = parseSiteSettings(settings({ babyName: '  Emma  ' }), NOW);
  assert.ok(result.ok);
  assert.equal(result.value.babyName, 'Emma');
  assert.deepEqual(errorsOf(settings({ babyName: 'x'.repeat(61) })), [
    { path: 'babyName', code: 'tooLong', params: { max: 60 } },
  ]);
});

test('a missing field is required, a wrongly typed one is invalidType', () => {
  const { milestones, ...withoutMilestones } = settings();
  assert.deepEqual(milestones, []);
  assert.deepEqual(errorsOf(withoutMilestones), [{ path: 'milestones', code: 'required' }]);
  assert.deepEqual(errorsOf(settings({ privacy: { showName: 'false' as unknown as boolean, showSex: true } })), [
    { path: 'privacy.showName', code: 'invalidType' },
  ]);
});

test('a field the schema does not know is rejected', () => {
  assert.deepEqual(errorsOf({ ...settings(), extra: 1 }), [{ path: 'extra', code: 'unknownField' }]);
});

test('Palette, Font, Languages and Sex accept only known options', () => {
  assert.deepEqual(errorsOf(settings({ theme: { palette: 'nope', font: 'comic-sans' } })), [
    { path: 'theme.palette', code: 'invalidOption' },
    { path: 'theme.font', code: 'invalidOption' },
  ]);
  assert.deepEqual(errorsOf(settings({ languages: ['en', 'fr' as 'en'] })), [
    { path: 'languages.1', code: 'invalidOption' },
  ]);
  assert.deepEqual(errorsOf(settings({ sex: 'other' as 'male' })), [{ path: 'sex', code: 'invalidOption' }]);
});

test('a Site speaks at least one Language, each once, the primary one first', () => {
  assert.deepEqual(errorsOf(settings({ languages: [] })), [{ path: 'languages', code: 'required' }]);
  assert.deepEqual(errorsOf(settings({ languages: ['it', 'en', 'it'] })), [
    { path: 'languages', code: 'invalidOption' },
  ]);
  const result = parseSiteSettings(settings({ languages: ['en', 'it'] }), NOW);
  assert.deepEqual(result.ok && result.value.languages, ['en', 'it']);
});

test('a Birth message exists only for a supported language', () => {
  const named = { babyName: 'Emma', sex: 'female' as const };
  assert.deepEqual(
    errorsOf(settings({ ...named, birth: born({ message: { fr: 'salut' } as unknown as { it: string } }) })),
    [{ path: 'birth.details.message.fr', code: 'unknownField' }]
  );
});

test('the Due date is a real calendar day within 10 months of today', () => {
  assert.equal(parseSiteSettings(settings({ dueDate: '2027-08-20' }), NOW).ok, true);
  assert.deepEqual(errorsOf(settings({ dueDate: '2027-02-30' })), [{ path: 'dueDate', code: 'invalidDate' }]);
  assert.deepEqual(errorsOf(settings({ dueDate: '2027-08-21' })), [
    { path: 'dueDate', code: 'outOfRange', params: { min: '2025-12-20', max: '2027-08-20' } },
  ]);
  assert.deepEqual(errorsOf(settings({ dueDate: '2025-12-19' }))[0].code, 'outOfRange');
});

test('the Born state requires a name and a known Sex, even when Privacy settings hide them', () => {
  const errors = errorsOf(settings({ privacy: { showName: false, showSex: false }, birth: born() }));
  assert.deepEqual(errors, [
    { path: 'babyName', code: 'required' },
    { path: 'sex', code: 'required' },
  ]);
});

test('Birth details exist only in the Born state', () => {
  assert.deepEqual(errorsOf(settings({ birth: { born: false, details: born().details } as never })), [
    { path: 'birth.details', code: 'invalidType' },
  ]);
  assert.deepEqual(
    errorsOf(settings({ babyName: 'Emma', sex: 'male', birth: { born: true, details: null } as never })),
    [{ path: 'birth.details', code: 'required' }]
  );
});

test('the birth date and time is a real instant, never after now', () => {
  const named = { babyName: 'Emma', sex: 'female' as const };
  assert.deepEqual(errorsOf(settings({ ...named, birth: born({ datetime: 'yesterday' }) })), [
    { path: 'birth.details.datetime', code: 'invalidDate' },
  ]);
  assert.deepEqual(errorsOf(settings({ ...named, birth: born({ datetime: '' }) })), [
    { path: 'birth.details.datetime', code: 'required' },
  ]);
  assert.deepEqual(errorsOf(settings({ ...named, birth: born({ datetime: '2026-10-20T12:00:01.000Z' }) })), [
    { path: 'birth.details.datetime', code: 'inFuture' },
  ]);
  assert.equal(parseSiteSettings(settings({ ...named, birth: born({ datetime: NOW.toISOString() }) }), NOW).ok, true);
});

test('weight and length stay within their ranges, weight in whole grams', () => {
  const named = { babyName: 'Emma', sex: 'female' as const };
  assert.deepEqual(errorsOf(settings({ ...named, birth: born({ weightGrams: 8001, lengthCm: 19 }) })), [
    { path: 'birth.details.weightGrams', code: 'outOfRange', params: { max: 8000 } },
    { path: 'birth.details.lengthCm', code: 'outOfRange', params: { min: 20 } },
  ]);
  assert.deepEqual(
    errorsOf(settings({ ...named, birth: born({ weightGrams: 3400.5 }) }))[0].path,
    'birth.details.weightGrams'
  );
  assert.equal(
    parseSiteSettings(settings({ ...named, birth: born({ weightGrams: null, lengthCm: null }) }), NOW).ok,
    true
  );
});

test('the Birth message is capped per language', () => {
  const named = { babyName: 'Emma', sex: 'female' as const };
  assert.deepEqual(errorsOf(settings({ ...named, birth: born({ message: { it: 'ciao', en: 'x'.repeat(1001) } }) })), [
    { path: 'birth.details.message.en', code: 'tooLong', params: { max: 1000 } },
  ]);
});

test('Milestones need a label and a real date, at most 50 of them', () => {
  assert.deepEqual(errorsOf(settings({ milestones: [{ label: '  ', date: '2026-13-01' }] })), [
    { path: 'milestones.0.label', code: 'required' },
    { path: 'milestones.0.date', code: 'invalidDate' },
  ]);
  assert.deepEqual(errorsOf(settings({ milestones: [{ label: 'Scan', date: '' }] })), [
    { path: 'milestones.0.date', code: 'required' },
  ]);
  const many = Array.from({ length: 51 }, () => ({ label: 'Scan', date: '2026-05-01' }));
  assert.deepEqual(errorsOf(settings({ milestones: many })), [
    { path: 'milestones', code: 'tooLong', params: { max: 50 } },
  ]);
});

test('a new Site lowercases its Slug and rejects bad or Reserved ones', () => {
  const ok = parseNewSite({ slug: '  Emma-Rose ', settings: defaultSiteSettings }, NOW);
  assert.ok(ok.ok);
  assert.equal(ok.value.slug, 'emma-rose');

  const errors = (input: unknown) => {
    const result = parseNewSite(input, NOW);
    return result.ok ? [] : result.errors;
  };
  assert.deepEqual(errors({ slug: '-bad', settings: defaultSiteSettings }), [{ path: 'slug', code: 'invalidFormat' }]);
  assert.deepEqual(errors({ slug: 'admin', settings: defaultSiteSettings }), [{ path: 'slug', code: 'slugReserved' }]);
  assert.deepEqual(errors({ slug: 'emma', settings: { ...defaultSiteSettings, dueDate: '2030-01-01' } })[0], {
    path: 'settings.dueDate',
    code: 'outOfRange',
    params: { min: '2025-12-20', max: '2027-08-20' },
  });
});

test('a Notification defaults to the name, hidden by Privacy settings only while Waiting', () => {
  const hidden = { showName: false, showSex: false };
  assert.equal(
    defaultNotificationTitle({ babyName: 'Emma', birth: { born: false, details: null }, privacy: hidden }),
    undefined
  );
  assert.equal(
    defaultNotificationTitle({ ...settings({ babyName: 'Emma' }), birth: { born: false, details: null } }),
    'Emma'
  );
  assert.equal(defaultNotificationTitle({ babyName: 'Emma', birth: born(), privacy: hidden }), 'Emma');
  assert.equal(defaultNotificationTitle({ babyName: '', birth: born(), privacy: hidden }), undefined);
});

test('the Timezone is any zone Intl knows, aliases included', () => {
  for (const timezone of ['Europe/Rome', 'America/New_York', 'Europe/Kiev', 'UTC']) {
    assert.equal(parseSiteSettings(settings({ timezone }), NOW).ok, true, timezone);
  }
  assert.deepEqual(errorsOf(settings({ timezone: 'Mars/Olympus' })), [{ path: 'timezone', code: 'invalidOption' }]);
  assert.deepEqual(errorsOf(settings({ timezone: '' })), [{ path: 'timezone', code: 'invalidOption' }]);
});
