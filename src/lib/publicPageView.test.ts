import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicPageView, publicPageViews } from './publicPageView.ts';
import { defaultSiteSettings, type SiteSettings } from './siteSettings.ts';

const NOW = new Date('2026-10-20T10:00:00Z');

function site(overrides: Partial<SiteSettings> = {}): SiteSettings {
  return {
    ...structuredClone(defaultSiteSettings),
    babyName: 'Emma',
    sex: 'female',
    dueDate: '2026-11-01',
    ...overrides,
  } as SiteSettings;
}

const BORN: SiteSettings['birth'] = {
  born: true,
  details: { datetime: '2026-10-19T08:30:00.000Z', weightGrams: 3400, lengthCm: 50, message: { it: 'Ciao', en: 'Hi' } },
};

test('the Waiting state leads with the Countdown', () => {
  const view = publicPageView(site(), 'en', NOW);
  assert.equal(view.tagline, 'Expecting');
  assert.equal(view.title, 'We are waiting for Emma');
  assert.equal(view.sex, null);
  assert.deepEqual(view.waiting, {
    dueDate: 'Due date: November 1, 2026',
    count: 12,
    unit: 'days to go',
    lateNote: null,
    week: { number: 39, label: 'Week 39 of 40' },
  });
  assert.equal(view.born, null);
});

test('the Countdown says the day itself, and how late after it', () => {
  assert.deepEqual(publicPageView(site({ dueDate: '2026-10-20' }), 'en', NOW).waiting, {
    dueDate: 'Due date: October 20, 2026',
    count: null,
    unit: 'Due today',
    lateNote: null,
    week: { number: 40, label: 'Week 40 of 40' },
  });
  assert.deepEqual(publicPageView(site({ dueDate: '2026-10-19' }), 'it', NOW).waiting, {
    dueDate: 'Arrivo previsto: 19 ottobre 2026',
    count: 1,
    unit: 'giorno in ritardo',
    lateNote: 'Se la sta prendendo comoda...',
    lateScene: { baby: 'Servizio in camera? Io resto qui.', mum: 'Il checkout era la settimana scorsa.' },
    week: { number: 41, label: 'Settimana 41' },
  });
});

test('the week of pregnancy counts back from the Due date as the end of week 40', () => {
  const weekFor = (dueDate: string, lang: 'en' | 'it' = 'en') =>
    publicPageView(site({ dueDate }), lang, NOW).waiting?.week ?? null;
  // NOW is 2026-10-20: 42 days before 2026-12-01.
  assert.deepEqual(weekFor('2026-12-01'), { number: 34, label: 'Week 34 of 40' });
  assert.deepEqual(weekFor('2026-12-01', 'it'), { number: 34, label: 'Settimana 34 di 40' });
  assert.equal(weekFor('2026-10-26')?.number, 40, 'the last six days are week 40');
  assert.equal(weekFor('2026-10-27')?.number, 39, 'a full week before is week 39');
  assert.equal(weekFor('2027-07-20')?.number, 1, '273 days before is week 1');
  assert.equal(weekFor('2027-07-27'), null, 'more than 39 weeks away is before week 1');
});

test("the Countdown follows the Site's Timezone", () => {
  // 23:30 on the 20th in New York is already the 21st in Rome.
  const lateEvening = new Date('2026-10-21T03:30:00Z');
  assert.equal(publicPageView(site({ dueDate: '2026-10-22' }), 'en', lateEvening).waiting?.count, 1);
  assert.equal(
    publicPageView(site({ dueDate: '2026-10-22', timezone: 'America/New_York' }), 'en', lateEvening).waiting?.count,
    2
  );
});

test('no Due date, no Countdown', () => {
  assert.equal(publicPageView(site({ dueDate: null }), 'en', NOW).waiting, null);
});

test('Privacy settings hide the name and Sex while Waiting', () => {
  const view = publicPageView(site({ privacy: { showName: false, showSex: false } }), 'it', NOW);
  assert.equal(view.title, 'Stiamo aspettando qualcuno');
  assert.equal(view.sex, null);
  assert.equal(publicPageView(site({ babyName: '' }), 'en', NOW).title, 'We are waiting for someone');
  assert.equal(publicPageView(site({ sex: 'unknown' }), 'en', NOW).sex, null);
});

test('the Born state announces the name and Sex whatever the Privacy settings', () => {
  const view = publicPageView(site({ birth: BORN, privacy: { showName: false, showSex: false } }), 'en', NOW);
  assert.equal(view.tagline, 'It’s a girl!');
  assert.equal(view.title, 'Welcome Emma');
  assert.equal(publicPageView(site({ birth: BORN }), 'it', NOW).tagline, 'È nata!');
  assert.equal(view.sex, null);
  assert.equal(view.waiting, null);
});

test('the Birth dialog previews the Born state before the name and Sex are given', () => {
  const nameless = { birth: BORN, babyName: '' };
  assert.equal(publicPageView(site({ ...nameless, sex: 'unknown' }), 'en', NOW).title, 'Welcome little one');
  assert.equal(publicPageView(site({ ...nameless, sex: 'unknown' }), 'en', NOW).tagline, 'Here at last!');
  assert.equal(publicPageView(site(nameless), 'it', NOW).title, 'Benvenuta piccola');
});

test('the Page name shows in its language, in both states and whatever the Privacy settings', () => {
  const pageName = { it: ' Stefania e Simone ', en: 'Stefania & Simone' };
  const hidden = { showName: false, showSex: false };
  assert.equal(publicPageView(site({ pageName, privacy: hidden }), 'it', NOW).pageName, 'Stefania e Simone');
  assert.equal(publicPageView(site({ pageName, birth: BORN }), 'en', NOW).pageName, 'Stefania & Simone');
  assert.equal(publicPageView(site({ pageName: { it: 'Stefania e Simone' } }), 'en', NOW).pageName, null);
  assert.equal(publicPageView(site({ pageName: { en: '   ' } }), 'en', NOW).pageName, null);
});

test("Birth details are told in the Site's Timezone and language", () => {
  assert.deepEqual(publicPageView(site({ birth: BORN }), 'en', NOW).born, {
    bornOn: 'Born on October 19, 2026 at 10:30',
    age: 1,
    ageLabel: 'day of life',
    stats: [
      { label: 'Weight', value: '3400 g' },
      { label: 'Length', value: '50 cm' },
    ],
    message: 'Hi',
  });
  assert.equal(publicPageView(site({ birth: BORN }), 'it', NOW).born?.bornOn, 'Nata il 19 ottobre 2026 alle 10:30');
  assert.equal(
    publicPageView(site({ birth: BORN, timezone: 'America/New_York' }), 'en', NOW).born?.bornOn,
    'Born on October 19, 2026 at 04:30'
  );
});

test('missing Birth details stay out', () => {
  const sparse: SiteSettings['birth'] = {
    born: true,
    details: { datetime: BORN.details?.datetime ?? '', weightGrams: null, lengthCm: null, message: { it: '  ' } },
  };
  const born = publicPageView(site({ birth: sparse }), 'en', NOW).born;
  assert.deepEqual([born?.stats, born?.message], [[], null]);
});

test("Milestones come in date order, dated and labelled in the page's language", () => {
  const milestones = [
    { emoji: '🎀', label: { it: 'Femminuccia!', en: 'It’s a girl!' }, date: '2026-06-10' },
    { emoji: '🩺', label: { it: 'Prima ecografia', en: 'First scan' }, date: '2026-04-02' },
  ];
  const languages: SiteSettings['languages'] = ['it', 'en'];
  assert.deepEqual(publicPageView(site({ languages, milestones }), 'it', NOW).milestones, {
    title: 'Tappe',
    items: [
      { emoji: '🩺', date: '2 aprile 2026', label: 'Prima ecografia', place: null },
      { emoji: '🎀', date: '10 giugno 2026', label: 'Femminuccia!', place: null },
    ],
  });
  assert.deepEqual(
    publicPageView(site({ languages, milestones }), 'en', NOW).milestones?.items.map((item) => item.label),
    ['First scan', 'It’s a girl!']
  );
  assert.equal(publicPageView(site(), 'en', NOW).milestones, null);
});

test("a Milestone's Place leads to its address on Google Maps, named in the page's language", () => {
  const place = { address: 'Via Roma 12, 20121 Milano, Italia', lat: 45.4642, lon: 9.19 };
  const milestones = [{ emoji: '🩺', label: { it: 'Ecografia', en: 'Scan' }, date: '2026-04-02', place }];
  const item = publicPageView(site({ languages: ['it', 'en'], milestones }), 'it', NOW).milestones?.items[0];
  assert.deepEqual(item?.place, {
    ...place,
    url: 'https://www.google.com/maps/search/?api=1&query=Via+Roma+12%2C+20121+Milano%2C+Italia',
    linkLabel: 'Apri Via Roma 12, 20121 Milano, Italia in Google Maps',
  });
});

test("the push button copy follows the Site's state", () => {
  assert.equal(publicPageView(site(), 'en', NOW).push.subscribe, 'Notify me when she arrives');
  assert.equal(publicPageView(site({ birth: BORN }), 'en', NOW).push.subscribe, 'Get the next updates');
});

test("a Site gets one view per Language, in the Platform's order", () => {
  assert.deepEqual(
    publicPageViews(site({ languages: ['it', 'en'] }), NOW).map((view) => [view.lang, view.title]),
    [
      ['it', 'Stiamo aspettando Emma'],
      ['en', 'We are waiting for Emma'],
    ]
  );
  assert.deepEqual(
    publicPageViews(site({ languages: ['it'] }), NOW).map((view) => view.lang),
    ['it']
  );
  assert.deepEqual(
    publicPageViews(site({ languages: ['en', 'it'] }), NOW).map((view) => view.lang),
    ['it', 'en']
  );
});

test('a view is plain data that survives serialization to a Client Component', () => {
  const view = publicPageView(
    site({ birth: BORN, milestones: [{ emoji: '🩺', label: { en: 'Scan' }, date: '2026-04-02' }] }),
    'en',
    NOW
  );
  assert.deepEqual(JSON.parse(JSON.stringify(view)), view);
});

test('late weeks remain visible beyond the two-week return track', () => {
  for (const [days, week] of [
    [1, 41],
    [7, 41],
    [8, 42],
    [14, 42],
    [15, 43],
    [28, 44],
  ]) {
    const now = new Date(Date.UTC(2026, 9, 20 + days, 10));
    for (const lang of ['en', 'it'] as const) {
      const waiting = publicPageView(site({ dueDate: '2026-10-20' }), lang, now).waiting;
      assert.equal(waiting?.count, days);
      assert.deepEqual(waiting?.week, { number: week, label: `${lang === 'en' ? 'Week' : 'Settimana'} ${week}` });
      assert.ok(waiting?.lateScene);
    }
  }
});
