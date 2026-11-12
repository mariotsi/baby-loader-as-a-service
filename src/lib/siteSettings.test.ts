import { assert, expect, test } from 'vitest';
import {
  defaultSiteSettings,
  isoDateTimeSchema,
  parseBirthPreview,
  parseNewSite,
  parseSiteSettings,
  type SiteSettingsInput,
  shownBabyName,
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
  expect(result.ok, 'expected the parse to fail').toBe(false);
  return result.ok ? [] : result.errors;
}

test('the default Site settings are valid', () => {
  expect(parseSiteSettings(defaultSiteSettings, NOW).ok).toBe(true);
});

test('a Born Site with name, Sex and Birth details is valid', () => {
  const result = parseSiteSettings(settings({ babyName: 'Emma', sex: 'female', birth: born() }), NOW);
  expect(result.ok).toBe(true);
});

test('the name is trimmed and capped at 60 characters', () => {
  const result = parseSiteSettings(settings({ babyName: '  Emma  ' }), NOW);
  assert(result.ok);
  expect(result.value.babyName).toBe('Emma');
  expect(errorsOf(settings({ babyName: 'x'.repeat(61) }))).toStrictEqual([
    { path: 'babyName', code: 'tooLong', params: { max: 60 } },
  ]);
});

test('a missing field is required, a wrongly typed one is invalidType', () => {
  const { milestones, ...withoutMilestones } = settings();
  expect(milestones).toStrictEqual([]);
  expect(errorsOf(withoutMilestones)).toStrictEqual([{ path: 'milestones', code: 'required' }]);
  expect(errorsOf(settings({ privacy: { showName: 'false' as unknown as boolean, showSex: true } }))).toStrictEqual([
    { path: 'privacy.showName', code: 'invalidType' },
  ]);
});

test('a field the schema does not know is rejected', () => {
  expect(errorsOf({ ...settings(), extra: 1 })).toStrictEqual([{ path: 'extra', code: 'unknownField' }]);
});

test('Palette, Font, Languages and Sex accept only known options', () => {
  expect(errorsOf(settings({ theme: { palette: 'nope', font: 'comic-sans' } }))).toStrictEqual([
    { path: 'theme.palette', code: 'invalidOption' },
    { path: 'theme.font', code: 'invalidOption' },
  ]);
  expect(errorsOf(settings({ languages: ['en', 'fr' as 'en'] }))).toStrictEqual([
    { path: 'languages.1', code: 'invalidOption' },
  ]);
  expect(errorsOf(settings({ sex: 'other' as 'male' }))).toStrictEqual([{ path: 'sex', code: 'invalidOption' }]);
});

test('a Site speaks at least one Language, each once', () => {
  expect(errorsOf(settings({ languages: [] }))).toStrictEqual([{ path: 'languages', code: 'required' }]);
  expect(errorsOf(settings({ languages: ['it', 'en', 'it'] }))).toStrictEqual([
    { path: 'languages', code: 'invalidOption' },
  ]);
  const result = parseSiteSettings(settings({ languages: ['en', 'it'] }), NOW);
  expect(result.ok && result.value.languages).toStrictEqual(['en', 'it']);
});

test('a Birth message exists only for a supported language', () => {
  const named = { babyName: 'Emma', sex: 'female' as const };
  expect(
    errorsOf(settings({ ...named, birth: born({ message: { fr: 'salut' } as unknown as { it: string } }) }))
  ).toStrictEqual([{ path: 'birth.details.message.fr', code: 'unknownField' }]);
});

test('the Due date is a real calendar day within 10 months of today', () => {
  expect(parseSiteSettings(settings({ dueDate: '2027-08-20' }), NOW).ok).toBe(true);
  expect(errorsOf(settings({ dueDate: '2027-02-30' }))).toStrictEqual([{ path: 'dueDate', code: 'invalidDate' }]);
  expect(errorsOf(settings({ dueDate: '2027-08-21' }))).toStrictEqual([
    { path: 'dueDate', code: 'outOfRange', params: { min: '2025-12-20', max: '2027-08-20' } },
  ]);
  expect(errorsOf(settings({ dueDate: '2025-12-19' }))[0].code).toStrictEqual('outOfRange');
});

test('the Born state requires a name and a known Sex, even when Privacy settings hide them', () => {
  const errors = errorsOf(settings({ privacy: { showName: false, showSex: false }, birth: born() }));
  expect(errors).toStrictEqual([
    { path: 'babyName', code: 'required' },
    { path: 'sex', code: 'required' },
  ]);
});

test('the Birth dialog previews a Born Site with no name or Sex, and nothing else that is invalid', () => {
  expect(parseBirthPreview(settings({ birth: born() }), NOW)?.babyName).toBe('');
  expect(parseBirthPreview(settings({ birth: born({ datetime: '2026-10-20T12:00:01.000Z' }) }), NOW)).toBe(null);
  expect(parseBirthPreview(settings({ birth: born({ datetime: '' }) }), NOW)).toBe(null);
});

test('Birth details exist only in the Born state', () => {
  expect(errorsOf(settings({ birth: { born: false, details: born().details } as never }))).toStrictEqual([
    { path: 'birth.details', code: 'invalidType' },
  ]);
  expect(
    errorsOf(settings({ babyName: 'Emma', sex: 'male', birth: { born: true, details: null } as never }))
  ).toStrictEqual([{ path: 'birth.details', code: 'required' }]);
});

test('the birth date and time is a real instant, never after now', () => {
  const named = { babyName: 'Emma', sex: 'female' as const };
  expect(errorsOf(settings({ ...named, birth: born({ datetime: 'yesterday' }) }))).toStrictEqual([
    { path: 'birth.details.datetime', code: 'invalidDate' },
  ]);
  expect(errorsOf(settings({ ...named, birth: born({ datetime: '' }) }))).toStrictEqual([
    { path: 'birth.details.datetime', code: 'required' },
  ]);
  expect(errorsOf(settings({ ...named, birth: born({ datetime: '2026-10-20T12:00:01.000Z' }) }))).toStrictEqual([
    { path: 'birth.details.datetime', code: 'inFuture' },
  ]);
  expect(parseSiteSettings(settings({ ...named, birth: born({ datetime: NOW.toISOString() }) }), NOW).ok).toBe(true);
});

test('weight and length stay within their ranges, weight in whole grams', () => {
  const named = { babyName: 'Emma', sex: 'female' as const };
  expect(errorsOf(settings({ ...named, birth: born({ weightGrams: 8001, lengthCm: 19 }) }))).toStrictEqual([
    { path: 'birth.details.weightGrams', code: 'outOfRange', params: { max: 8000 } },
    { path: 'birth.details.lengthCm', code: 'outOfRange', params: { min: 20 } },
  ]);
  expect(errorsOf(settings({ ...named, birth: born({ weightGrams: 3400.5 }) }))[0].path).toStrictEqual(
    'birth.details.weightGrams'
  );
  expect(parseSiteSettings(settings({ ...named, birth: born({ weightGrams: null, lengthCm: null }) }), NOW).ok).toBe(
    true
  );
});

test('the Birth message is capped per language', () => {
  const named = { babyName: 'Emma', sex: 'female' as const };
  expect(
    errorsOf(settings({ ...named, birth: born({ message: { it: 'ciao', en: 'x'.repeat(1001) } }) }))
  ).toStrictEqual([{ path: 'birth.details.message.en', code: 'tooLong', params: { max: 1000 } }]);
});

test('the Page name is trimmed, capped at 60 characters per language and kept for any supported one', () => {
  const result = parseSiteSettings(
    settings({ languages: ['en'], pageName: { en: '  Stefania & Simone ', it: 'S e S' } }),
    NOW
  );
  assert(result.ok);
  expect(result.value.pageName).toStrictEqual({ en: 'Stefania & Simone', it: 'S e S' });
  expect(errorsOf(settings({ pageName: { en: 'x'.repeat(61) } }))).toStrictEqual([
    { path: 'pageName.en', code: 'tooLong', params: { max: 60 } },
  ]);
  expect(errorsOf(settings({ pageName: { fr: 'Stéphanie' } as unknown as { en: string } }))).toStrictEqual([
    { path: 'pageName.fr', code: 'unknownField' },
  ]);
});

test('Milestones need an emoji, a label and a real date, at most 50 of them', () => {
  expect(errorsOf(settings({ milestones: [{ emoji: '✨', label: { en: '  ' }, date: '2026-13-01' }] }))).toStrictEqual([
    { path: 'milestones.0.date', code: 'invalidDate' },
    { path: 'milestones.0.label.en', code: 'required' },
  ]);
  expect(errorsOf(settings({ milestones: [{ emoji: '✨', label: { en: 'Scan' }, date: '' }] }))).toStrictEqual([
    { path: 'milestones.0.date', code: 'required' },
  ]);
  const many = Array.from({ length: 51 }, () => ({ emoji: '✨', label: { en: 'Scan' }, date: '2026-05-01' }));
  expect(errorsOf(settings({ milestones: many }))).toStrictEqual([
    { path: 'milestones', code: 'tooLong', params: { max: 50 } },
  ]);
});

test("a Milestone's emoji is exactly one emoji, joined sequences and skin tones included", () => {
  const withEmoji = (emoji: string) => settings({ milestones: [{ emoji, label: { en: 'Scan' }, date: '2026-05-01' }] });
  for (const emoji of ['🍼', '👶🏽', '👨‍👩‍👧', '🇮🇹', '❤️']) {
    expect(parseSiteSettings(withEmoji(emoji), NOW).ok, emoji).toBe(true);
  }
  expect(errorsOf(withEmoji(''))).toStrictEqual([{ path: 'milestones.0.emoji', code: 'required' }]);
  for (const emoji of ['a', '🍼🍼', ' 🍼']) {
    expect(errorsOf(withEmoji(emoji)), emoji).toStrictEqual([{ path: 'milestones.0.emoji', code: 'invalidFormat' }]);
  }
});

test('the Site icon is the loading baby, or exactly one emoji', () => {
  expect(parseSiteSettings(settings({ icon: null }), NOW).ok).toBe(true);
  expect(parseSiteSettings(settings({ icon: '🐣' }), NOW).ok).toBe(true);
  expect(errorsOf(settings({ icon: '' }))).toStrictEqual([{ path: 'icon', code: 'required' }]);
  expect(errorsOf(settings({ icon: '🐣🐣' }))).toStrictEqual([{ path: 'icon', code: 'invalidFormat' }]);
  const { icon: _, ...withoutIcon } = settings();
  expect(errorsOf(withoutIcon)).toStrictEqual([{ path: 'icon', code: 'required' }]);
});

test("a Milestone's label is needed in every Language of the Site, and kept in one it no longer speaks", () => {
  const scan = (label: Record<string, string>) => ({ emoji: '✨', label, date: '2026-05-01' });
  expect(
    errorsOf(settings({ languages: ['it', 'en'], milestones: [scan({ en: 'Scan' }), scan({ it: '' })] }))
  ).toStrictEqual([
    { path: 'milestones.0.label.it', code: 'required' },
    { path: 'milestones.1.label.it', code: 'required' },
    { path: 'milestones.1.label.en', code: 'required' },
  ]);
  const kept = parseSiteSettings(
    settings({ languages: ['en'], milestones: [scan({ en: ' Scan ', it: 'Ecografia' })] }),
    NOW
  );
  assert(kept.ok);
  expect(kept.value.milestones[0].label).toStrictEqual({ en: 'Scan', it: 'Ecografia' });
  expect(errorsOf(settings({ languages: ['it', 'en'], milestones: [scan({ en: 'x'.repeat(81) })] }))).toStrictEqual([
    { path: 'milestones.0.label.en', code: 'tooLong', params: { max: 80 } },
    { path: 'milestones.0.label.it', code: 'required' },
  ]);
});

test("a Milestone's Place is optional, and needs an address and a point on Earth", () => {
  const withPlace = (place: unknown) =>
    settings({ milestones: [{ emoji: '✨', label: { en: 'Scan' }, date: '2026-05-01', place } as never] });
  const kept = parseSiteSettings(withPlace({ address: ' Via Roma 12, Milano ', lat: 45.46, lon: 9.19 }), NOW);
  assert(kept.ok);
  expect(kept.value.milestones[0].place).toStrictEqual({ address: 'Via Roma 12, Milano', lat: 45.46, lon: 9.19 });
  expect(parseSiteSettings(withPlace(undefined), NOW).ok).toBe(true);

  expect(errorsOf(withPlace({ address: '  ', lat: 91, lon: -181 }))).toStrictEqual([
    { path: 'milestones.0.place.address', code: 'required' },
    { path: 'milestones.0.place.lat', code: 'outOfRange', params: { max: 90 } },
    { path: 'milestones.0.place.lon', code: 'outOfRange', params: { min: -180 } },
  ]);
  expect(errorsOf(withPlace({ address: 'x'.repeat(201), lat: 0, lon: 0 }))).toStrictEqual([
    { path: 'milestones.0.place.address', code: 'tooLong', params: { max: 200 } },
  ]);
  expect(errorsOf(withPlace({ address: 'Milano' }))).toStrictEqual([
    { path: 'milestones.0.place.lat', code: 'required' },
    { path: 'milestones.0.place.lon', code: 'required' },
  ]);
  expect(errorsOf(withPlace({ address: 'Milano', lat: 45.46, lon: 9.19, label: 'Home' }))).toStrictEqual([
    { path: 'milestones.0.place.label', code: 'unknownField' },
  ]);
  expect(errorsOf(withPlace(null))).toStrictEqual([{ path: 'milestones.0.place', code: 'required' }]);
});

test('a missing label is reported beside the other errors of the same save', () => {
  expect(
    errorsOf(settings({ babyName: 'x'.repeat(61), milestones: [{ emoji: '✨', label: {}, date: '' }] }))
  ).toStrictEqual([
    { path: 'babyName', code: 'tooLong', params: { max: 60 } },
    { path: 'milestones.0.date', code: 'required' },
    { path: 'milestones.0.label.en', code: 'required' },
  ]);
});

test('a new Site lowercases its Slug and rejects bad or Reserved ones', () => {
  const ok = parseNewSite({ slug: '  Emma-Rose ', settings: settings({ dueDate: '2026-11-01' }) }, NOW);
  assert(ok.ok);
  expect(ok.value.slug).toBe('emma-rose');

  const errors = (input: unknown) => {
    const result = parseNewSite(input, NOW);
    return result.ok ? [] : result.errors;
  };
  expect(errors({ slug: '-bad', settings: defaultSiteSettings })).toStrictEqual([
    { path: 'slug', code: 'invalidFormat' },
  ]);
  expect(errors({ slug: 'admin', settings: defaultSiteSettings })).toStrictEqual([
    { path: 'slug', code: 'slugReserved' },
  ]);
  expect(errors({ slug: 'emma', settings: { ...defaultSiteSettings, dueDate: '2030-01-01' } })[0]).toStrictEqual({
    path: 'settings.dueDate',
    code: 'outOfRange',
    params: { min: '2025-12-20', max: '2027-08-20' },
  });
});

test('a new Site needs a Due date', () => {
  const result = parseNewSite({ slug: 'emma', settings: settings() }, NOW);
  expect(result.ok ? [] : result.errors).toStrictEqual([{ path: 'settings.dueDate', code: 'required' }]);
});

test('a new Site starts Waiting', () => {
  const bornSite = {
    ...defaultSiteSettings,
    babyName: 'Emma',
    sex: 'female',
    dueDate: '2026-11-01',
    birth: {
      born: true,
      details: { datetime: '2026-01-01T08:00:00.000Z', weightGrams: null, lengthCm: null, message: {} },
    },
  };
  const result = parseNewSite({ slug: 'emma', settings: bornSite }, NOW);
  expect(result.ok).toBe(false);
  expect(result.ok ? [] : result.errors).toStrictEqual([{ path: 'settings.birth', code: 'invalidOption' }]);
});

test('the shown name is the baby’s, hidden by Privacy settings only while Waiting', () => {
  const hidden = { showName: false, showSex: false };
  expect(shownBabyName({ babyName: 'Emma', birth: { born: false, details: null }, privacy: hidden })).toBe(null);
  expect(shownBabyName({ ...settings({ babyName: 'Emma' }), birth: { born: false, details: null } })).toBe('Emma');
  const { photo: _, ...details } = born().details;
  const birth = {
    born: true as const,
    details: { ...details, datetime: isoDateTimeSchema.parse(details.datetime), weightGrams: null, lengthCm: null },
  };
  expect(shownBabyName({ babyName: 'Emma', birth, privacy: hidden })).toBe('Emma');
  expect(shownBabyName({ babyName: '', birth, privacy: hidden })).toBe(null);
});

test('the Timezone is any zone Intl knows, aliases included', () => {
  for (const timezone of ['Europe/Rome', 'America/New_York', 'Europe/Kiev', 'UTC']) {
    expect(parseSiteSettings(settings({ timezone }), NOW).ok, timezone).toBe(true);
  }
  expect(errorsOf(settings({ timezone: 'Mars/Olympus' }))).toStrictEqual([{ path: 'timezone', code: 'invalidOption' }]);
  expect(errorsOf(settings({ timezone: '' }))).toStrictEqual([{ path: 'timezone', code: 'invalidOption' }]);
});

test('birth media accepts stored HTTPS assets and remains optional for existing Sites', () => {
  const photo = {
    key: 'customer-data/owner/site/0b9f3c1e-2a4d-4c5e-8f60-71829304a5b6',
    url: 'https://media.example.com/photo',
    name: 'hello.png',
    type: 'image/png' as const,
    size: 2048,
  };
  expect(
    parseSiteSettings(settings({ babyName: 'Emma', sex: 'female', birth: born({ photo }), birthVideo: null }), NOW).ok
  ).toBe(true);
  expect(parseSiteSettings(settings({ babyName: 'Emma', sex: 'female', birth: born() }), NOW).ok).toBe(true);
  expect(
    parseSiteSettings(
      settings({ babyName: 'Emma', sex: 'female', birth: born({ photo: { ...photo, url: 'javascript:alert(1)' } }) }),
      NOW
    ).ok
  ).toBe(false);
  expect(
    parseSiteSettings(
      settings({
        babyName: 'Emma',
        sex: 'female',
        birth: born({ photo: { ...photo, url: 'http://media.example.com/photo' } }),
      }),
      NOW
    ).ok
  ).toBe(false);
});

test('the Birth video can be picked in the Waiting state and is no Birth detail', () => {
  const birthVideo = {
    key: 'customer-data/owner/site/1c0a4d2f-3b5e-4d6f-9071-829304a5b6c7',
    url: 'https://media.example.com/video',
  };
  expect(parseSiteSettings(settings({ birthVideo }), NOW).ok).toBe(true);
  expect(
    errorsOf(settings({ babyName: 'Emma', sex: 'female', birth: born({ video: birthVideo } as object) }))
  ).toStrictEqual([{ path: 'birth.details.video', code: 'unknownField' }]);
  expect(errorsOf(settings({ birthVideo: { ...birthVideo, url: 'http://media.example.com/video' } }))).toStrictEqual([
    { path: 'birthVideo.url', code: 'invalidType' },
  ]);
});
