import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  defaultNotificationTitle,
  defaultSiteSettings,
  parseBirthPreview,
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

test('a Site speaks at least one Language, each once', () => {
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

test('the Birth dialog previews a Born Site with no name or Sex, and nothing else that is invalid', () => {
  assert.equal(parseBirthPreview(settings({ birth: born() }), NOW)?.babyName, '');
  assert.equal(parseBirthPreview(settings({ birth: born({ datetime: '2026-10-20T12:00:01.000Z' }) }), NOW), null);
  assert.equal(parseBirthPreview(settings({ birth: born({ datetime: '' }) }), NOW), null);
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

test('the Page name is trimmed, capped at 60 characters per language and kept for any supported one', () => {
  const result = parseSiteSettings(
    settings({ languages: ['en'], pageName: { en: '  Stefania & Simone ', it: 'S e S' } }),
    NOW
  );
  assert.ok(result.ok);
  assert.deepEqual(result.value.pageName, { en: 'Stefania & Simone', it: 'S e S' });
  assert.deepEqual(errorsOf(settings({ pageName: { en: 'x'.repeat(61) } })), [
    { path: 'pageName.en', code: 'tooLong', params: { max: 60 } },
  ]);
  assert.deepEqual(errorsOf(settings({ pageName: { fr: 'Stéphanie' } as unknown as { en: string } })), [
    { path: 'pageName.fr', code: 'unknownField' },
  ]);
});

test('Milestones need an emoji, a label and a real date, at most 50 of them', () => {
  assert.deepEqual(errorsOf(settings({ milestones: [{ emoji: '✨', label: { en: '  ' }, date: '2026-13-01' }] })), [
    { path: 'milestones.0.date', code: 'invalidDate' },
    { path: 'milestones.0.label.en', code: 'required' },
  ]);
  assert.deepEqual(errorsOf(settings({ milestones: [{ emoji: '✨', label: { en: 'Scan' }, date: '' }] })), [
    { path: 'milestones.0.date', code: 'required' },
  ]);
  const many = Array.from({ length: 51 }, () => ({ emoji: '✨', label: { en: 'Scan' }, date: '2026-05-01' }));
  assert.deepEqual(errorsOf(settings({ milestones: many })), [
    { path: 'milestones', code: 'tooLong', params: { max: 50 } },
  ]);
});

test("a Milestone's emoji is exactly one emoji, joined sequences and skin tones included", () => {
  const withEmoji = (emoji: string) => settings({ milestones: [{ emoji, label: { en: 'Scan' }, date: '2026-05-01' }] });
  for (const emoji of ['🍼', '👶🏽', '👨‍👩‍👧', '🇮🇹', '❤️']) {
    assert.equal(parseSiteSettings(withEmoji(emoji), NOW).ok, true, emoji);
  }
  assert.deepEqual(errorsOf(withEmoji('')), [{ path: 'milestones.0.emoji', code: 'required' }]);
  for (const emoji of ['a', '🍼🍼', ' 🍼']) {
    assert.deepEqual(errorsOf(withEmoji(emoji)), [{ path: 'milestones.0.emoji', code: 'invalidFormat' }], emoji);
  }
});

test('the Site icon is the loading baby, or exactly one emoji', () => {
  assert.equal(parseSiteSettings(settings({ icon: null }), NOW).ok, true);
  assert.equal(parseSiteSettings(settings({ icon: '🐣' }), NOW).ok, true);
  assert.deepEqual(errorsOf(settings({ icon: '' })), [{ path: 'icon', code: 'required' }]);
  assert.deepEqual(errorsOf(settings({ icon: '🐣🐣' })), [{ path: 'icon', code: 'invalidFormat' }]);
  const { icon: _, ...withoutIcon } = settings();
  assert.deepEqual(errorsOf(withoutIcon), [{ path: 'icon', code: 'required' }]);
});

test("a Milestone's label is needed in every Language of the Site, and kept in one it no longer speaks", () => {
  const scan = (label: Record<string, string>) => ({ emoji: '✨', label, date: '2026-05-01' });
  assert.deepEqual(
    errorsOf(settings({ languages: ['it', 'en'], milestones: [scan({ en: 'Scan' }), scan({ it: '' })] })),
    [
      { path: 'milestones.0.label.it', code: 'required' },
      { path: 'milestones.1.label.it', code: 'required' },
      { path: 'milestones.1.label.en', code: 'required' },
    ]
  );
  const kept = parseSiteSettings(
    settings({ languages: ['en'], milestones: [scan({ en: ' Scan ', it: 'Ecografia' })] }),
    NOW
  );
  assert.ok(kept.ok);
  assert.deepEqual(kept.value.milestones[0].label, { en: 'Scan', it: 'Ecografia' });
  assert.deepEqual(errorsOf(settings({ languages: ['it', 'en'], milestones: [scan({ en: 'x'.repeat(81) })] })), [
    { path: 'milestones.0.label.en', code: 'tooLong', params: { max: 80 } },
    { path: 'milestones.0.label.it', code: 'required' },
  ]);
});

test("a Milestone's Place is optional, and needs an address and a point on Earth", () => {
  const withPlace = (place: unknown) =>
    settings({ milestones: [{ emoji: '✨', label: { en: 'Scan' }, date: '2026-05-01', place } as never] });
  const kept = parseSiteSettings(withPlace({ address: ' Via Roma 12, Milano ', lat: 45.46, lon: 9.19 }), NOW);
  assert.ok(kept.ok);
  assert.deepEqual(kept.value.milestones[0].place, { address: 'Via Roma 12, Milano', lat: 45.46, lon: 9.19 });
  assert.equal(parseSiteSettings(withPlace(undefined), NOW).ok, true);

  assert.deepEqual(errorsOf(withPlace({ address: '  ', lat: 91, lon: -181 })), [
    { path: 'milestones.0.place.address', code: 'required' },
    { path: 'milestones.0.place.lat', code: 'outOfRange', params: { max: 90 } },
    { path: 'milestones.0.place.lon', code: 'outOfRange', params: { min: -180 } },
  ]);
  assert.deepEqual(errorsOf(withPlace({ address: 'x'.repeat(201), lat: 0, lon: 0 })), [
    { path: 'milestones.0.place.address', code: 'tooLong', params: { max: 200 } },
  ]);
  assert.deepEqual(errorsOf(withPlace({ address: 'Milano' })), [
    { path: 'milestones.0.place.lat', code: 'required' },
    { path: 'milestones.0.place.lon', code: 'required' },
  ]);
  assert.deepEqual(errorsOf(withPlace({ address: 'Milano', lat: 45.46, lon: 9.19, label: 'Home' })), [
    { path: 'milestones.0.place.label', code: 'unknownField' },
  ]);
  assert.deepEqual(errorsOf(withPlace(null)), [{ path: 'milestones.0.place', code: 'required' }]);
});

test('a missing label is reported beside the other errors of the same save', () => {
  assert.deepEqual(
    errorsOf(settings({ babyName: 'x'.repeat(61), milestones: [{ emoji: '✨', label: {}, date: '' }] })),
    [
      { path: 'babyName', code: 'tooLong', params: { max: 60 } },
      { path: 'milestones.0.date', code: 'required' },
      { path: 'milestones.0.label.en', code: 'required' },
    ]
  );
});

test('a new Site lowercases its Slug and rejects bad or Reserved ones', () => {
  const ok = parseNewSite({ slug: '  Emma-Rose ', settings: settings({ dueDate: '2026-11-01' }) }, NOW);
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

test('a new Site needs a Due date', () => {
  const result = parseNewSite({ slug: 'emma', settings: settings() }, NOW);
  assert.deepEqual(result.ok ? [] : result.errors, [{ path: 'settings.dueDate', code: 'required' }]);
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
  assert.equal(result.ok, false);
  assert.deepEqual(result.ok ? [] : result.errors, [{ path: 'settings.birth', code: 'invalidOption' }]);
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

test('birth media accepts stored HTTPS assets and remains optional for existing Sites', () => {
  const photo = {
    key: 'customer-data/owner/site/photo',
    url: 'https://media.example.com/photo',
    name: 'hello.png',
    type: 'image/png' as const,
    size: 2048,
  };
  assert.equal(
    parseSiteSettings(settings({ babyName: 'Emma', sex: 'female', birth: born({ photo }), birthVideo: null }), NOW).ok,
    true
  );
  assert.equal(parseSiteSettings(settings({ babyName: 'Emma', sex: 'female', birth: born() }), NOW).ok, true);
  assert.equal(
    parseSiteSettings(
      settings({ babyName: 'Emma', sex: 'female', birth: born({ photo: { ...photo, url: 'javascript:alert(1)' } }) }),
      NOW
    ).ok,
    false
  );
  assert.equal(
    parseSiteSettings(
      settings({
        babyName: 'Emma',
        sex: 'female',
        birth: born({ photo: { ...photo, url: 'http://media.example.com/photo' } }),
      }),
      NOW
    ).ok,
    false
  );
});

test('the Birth video can be picked in the Waiting state and is no Birth detail', () => {
  const birthVideo = { key: 'customer-data/owner/site/video', url: 'https://media.example.com/video' };
  assert.equal(parseSiteSettings(settings({ birthVideo }), NOW).ok, true);
  assert.deepEqual(
    errorsOf(settings({ babyName: 'Emma', sex: 'female', birth: born({ video: birthVideo } as object) })),
    [{ path: 'birth.details.video', code: 'unknownField' }]
  );
  assert.deepEqual(errorsOf(settings({ birthVideo: { ...birthVideo, url: 'http://media.example.com/video' } })), [
    { path: 'birthVideo.url', code: 'invalidType' },
  ]);
});
