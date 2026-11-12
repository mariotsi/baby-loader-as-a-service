import { expect, test } from 'vitest';
import { mediaUrlSchema } from './birthMedia.ts';
import { NO_BORN_MEDIA, publicPageView, publicPageViews } from './publicPageView.ts';
import {
  calendarDaySchema,
  centimetresSchema,
  defaultSiteSettings,
  emojiSchema,
  gramsSchema,
  isoDateTimeSchema,
  type SiteSettings,
  timeZoneSchema,
} from './siteSettings.ts';

const asDay = (value: string) => calendarDaySchema.parse(value);
const asEmoji = (value: string) => emojiSchema.parse(value);
const asInstant = (value: string) => isoDateTimeSchema.parse(value);
const asZone = (value: string) => timeZoneSchema.parse(value);

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
  details: {
    datetime: asInstant('2026-10-19T08:30:00.000Z'),
    weightGrams: gramsSchema.parse(3400),
    lengthCm: centimetresSchema.parse(50),
    message: { it: 'Ciao', en: 'Hi' },
  },
};

test('the Waiting state leads with the Countdown', () => {
  const view = publicPageView(site(), 'en', NOW);
  expect(view.tagline).toBe('Expecting');
  expect(view.title).toBe('We are waiting for Emma');
  expect(view.waiting).toStrictEqual({
    dueDate: 'Due date: November 1, 2026',
    count: 12,
    unit: 'days to go',
    lateNote: null,
    week: { number: 39, label: 'Week 39 of 40' },
  });
  expect(view.born).toBe(null);
});

test('the Countdown says the day itself, and how late after it', () => {
  expect(publicPageView(site({ dueDate: asDay('2026-10-20') }), 'en', NOW).waiting).toStrictEqual({
    dueDate: 'Due date: October 20, 2026',
    count: null,
    unit: 'Due today',
    lateNote: null,
    week: { number: 40, label: 'Week 40 of 40' },
  });
  expect(publicPageView(site({ dueDate: asDay('2026-10-19') }), 'it', NOW).waiting).toStrictEqual({
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
    publicPageView(site({ dueDate: asDay(dueDate) }), lang, NOW).waiting?.week ?? null;
  // NOW is 2026-10-20: 42 days before 2026-12-01.
  expect(weekFor('2026-12-01')).toStrictEqual({ number: 34, label: 'Week 34 of 40' });
  expect(weekFor('2026-12-01', 'it')).toStrictEqual({ number: 34, label: 'Settimana 34 di 40' });
  expect(weekFor('2026-10-26')?.number, 'the last six days are week 40').toBe(40);
  expect(weekFor('2026-10-27')?.number, 'a full week before is week 39').toBe(39);
  expect(weekFor('2027-07-20')?.number, '273 days before is week 1').toBe(1);
  expect(weekFor('2027-07-27'), 'more than 39 weeks away is before week 1').toBe(null);
});

test("the Countdown follows the Site's Timezone", () => {
  // 23:30 on the 20th in New York is already the 21st in Rome.
  const lateEvening = new Date('2026-10-21T03:30:00Z');
  expect(publicPageView(site({ dueDate: asDay('2026-10-22') }), 'en', lateEvening).waiting?.count).toBe(1);
  expect(
    publicPageView(site({ dueDate: asDay('2026-10-22'), timezone: asZone('America/New_York') }), 'en', lateEvening)
      .waiting?.count
  ).toBe(2);
});

test('no Due date, no Countdown', () => {
  expect(publicPageView(site({ dueDate: null }), 'en', NOW).waiting).toBe(null);
});

test('Privacy settings hide the name and Sex while Waiting', () => {
  const hidden = publicPageView(site({ privacy: { showName: false, showSex: false } }), 'en', NOW);
  expect(hidden.title).toBe('We are waiting for someone');
  expect(hidden.push.subscribe).toBe('Notify me when they arrive');
  expect(hidden.push.appName).toBe('Loading Baby');
  const shown = publicPageView(site(), 'en', NOW);
  expect(shown.title).toBe('We are waiting for Emma');
  expect(shown.push.subscribe).toBe('Notify me when she arrives');
  expect(shown.push.appName).toBe('Emma');
  expect(publicPageView(site({ babyName: '' }), 'en', NOW).title).toBe('We are waiting for someone');
  expect(publicPageView(site({ sex: 'unknown' }), 'en', NOW).push.subscribe).toBe('Notify me when they arrive');
});

test('the Born state announces the name and Sex whatever the Privacy settings', () => {
  const view = publicPageView(site({ birth: BORN, privacy: { showName: false, showSex: false } }), 'en', NOW);
  expect(view.tagline).toBe('It’s a girl!');
  expect(view.title).toBe('Welcome Emma');
  expect(publicPageView(site({ birth: BORN }), 'it', NOW).tagline).toBe('È nata!');
  expect(view.push.appName).toBe('Emma');
  expect(view.waiting).toBe(null);
});

test('the Birth dialog previews the Born state before the name and Sex are given', () => {
  const nameless = { birth: BORN, babyName: '' };
  expect(publicPageView(site({ ...nameless, sex: 'unknown' }), 'en', NOW).title).toBe('Welcome little one');
  expect(publicPageView(site({ ...nameless, sex: 'unknown' }), 'en', NOW).tagline).toBe('Here at last!');
  expect(publicPageView(site(nameless), 'it', NOW).title).toBe('Benvenuta piccola');
});

test('the Page name shows in its language, in both states and whatever the Privacy settings', () => {
  const pageName = { it: ' Stefania e Simone ', en: 'Stefania & Simone' };
  const hidden = { showName: false, showSex: false };
  expect(publicPageView(site({ pageName, privacy: hidden }), 'it', NOW).pageName).toBe('Stefania e Simone');
  expect(publicPageView(site({ pageName, birth: BORN }), 'en', NOW).pageName).toBe('Stefania & Simone');
  expect(publicPageView(site({ pageName: { it: 'Stefania e Simone' } }), 'en', NOW).pageName).toBe(null);
  expect(publicPageView(site({ pageName: { en: '   ' } }), 'en', NOW).pageName).toBe(null);
});

test("Birth details are told in the Site's Timezone and language", () => {
  expect(publicPageView(site({ birth: BORN }), 'en', NOW).born).toStrictEqual({
    bornOn: 'Born on October 19, 2026 at 10:30',
    age: 1,
    ageLabel: 'day of life',
    stats: [
      { label: 'Weight', value: '3400 g' },
      { label: 'Length', value: '50 cm' },
    ],
    message: 'Hi',
    photoUrl: NO_BORN_MEDIA.placeholder,
    video: null,
  });
  expect(publicPageView(site({ birth: BORN }), 'it', NOW).born?.bornOn).toBe('Nata il 19 ottobre 2026 alle 10:30');
  expect(publicPageView(site({ birth: BORN, timezone: asZone('America/New_York') }), 'en', NOW).born?.bornOn).toBe(
    'Born on October 19, 2026 at 04:30'
  );
});

test('missing Birth details stay out', () => {
  const sparse: SiteSettings['birth'] = {
    born: true,
    details: { datetime: BORN.details?.datetime ?? '', weightGrams: null, lengthCm: null, message: { it: '  ' } },
  };
  const born = publicPageView(site({ birth: sparse }), 'en', NOW).born;
  expect([born?.stats, born?.message]).toStrictEqual([[], null]);
});

test("Milestones come in date order, dated and labelled in the page's language", () => {
  const milestones = [
    { emoji: asEmoji('🎀'), label: { it: 'Femminuccia!', en: 'It’s a girl!' }, date: asDay('2026-06-10') },
    { emoji: asEmoji('🩺'), label: { it: 'Prima ecografia', en: 'First scan' }, date: asDay('2026-04-02') },
  ];
  const languages: SiteSettings['languages'] = ['it', 'en'];
  expect(publicPageView(site({ languages, milestones }), 'it', NOW).milestones).toStrictEqual({
    title: 'Tappe',
    items: [
      { emoji: asEmoji('🩺'), date: '2 aprile 2026', label: 'Prima ecografia', place: null },
      { emoji: asEmoji('🎀'), date: '10 giugno 2026', label: 'Femminuccia!', place: null },
    ],
  });
  expect(
    publicPageView(site({ languages, milestones }), 'en', NOW).milestones?.items.map((item) => item.label)
  ).toStrictEqual(['First scan', 'It’s a girl!']);
  expect(publicPageView(site(), 'en', NOW).milestones).toBe(null);
});

test("a Milestone's Place leads to its address on Google Maps, named in the page's language", () => {
  const place = { address: 'Via Roma 12, 20121 Milano, Italia', lat: 45.4642, lon: 9.19 };
  const milestones = [
    { emoji: asEmoji('🩺'), label: { it: 'Ecografia', en: 'Scan' }, date: asDay('2026-04-02'), place },
  ];
  const item = publicPageView(site({ languages: ['it', 'en'], milestones }), 'it', NOW).milestones?.items[0];
  expect(item?.place).toStrictEqual({
    ...place,
    url: 'https://www.google.com/maps/search/?api=1&query=Via+Roma+12%2C+20121+Milano%2C+Italia',
    linkLabel: 'Apri Via Roma 12, 20121 Milano, Italia in Google Maps',
  });
});

test("the push button copy follows the Site's state", () => {
  expect(publicPageView(site(), 'en', NOW).push.subscribe).toBe('Notify me when she arrives');
  expect(publicPageView(site({ birth: BORN }), 'en', NOW).push.subscribe).toBe('Get the next updates');
});

test('the Born state shows the birth photo, else the placeholder, and the Birth video with its words', () => {
  const media = {
    photo: mediaUrlSchema.parse('https://media.test/photo'),
    video: mediaUrlSchema.parse('https://media.test/video'),
    placeholder: mediaUrlSchema.parse('/placeholder.png'),
  };
  const born = publicPageView(site({ birth: BORN }), 'it', NOW, media).born;
  expect(born?.photoUrl).toBe('https://media.test/photo');
  expect(born?.video).toStrictEqual({
    url: 'https://media.test/video',
    replay: 'Riguarda il benvenuto',
    reveal: { label: 'Il nostro benvenuto', close: 'Chiudi il video', turnOnSound: 'Attiva audio' },
  });
  const bare = publicPageView(site({ birth: BORN }), 'en', NOW, { ...media, photo: null, video: null }).born;
  expect(bare?.photoUrl).toBe('/placeholder.png');
  expect(bare?.video).toBe(null);
  expect(publicPageView(site(), 'en', NOW, media).born, 'Waiting shows neither').toBe(null);
});

test('the page speaks its own language when sharing', () => {
  expect(publicPageView(site(), 'it', NOW).linkCopied).toBe('Link copiato');
  expect(publicPageView(site(), 'en', NOW).linkCopied).toBe('Link copied');
});

test("a Site gets one view per Language, in the Platform's order", () => {
  expect(publicPageViews(site({ languages: ['it', 'en'] }), NOW).map((view) => [view.lang, view.title])).toStrictEqual([
    ['it', 'Stiamo aspettando Emma'],
    ['en', 'We are waiting for Emma'],
  ]);
  expect(publicPageViews(site({ languages: ['it'] }), NOW).map((view) => view.lang)).toStrictEqual(['it']);
  expect(publicPageViews(site({ languages: ['en', 'it'] }), NOW).map((view) => view.lang)).toStrictEqual(['it', 'en']);
});

test('a view is plain data that survives serialization to a Client Component', () => {
  const view = publicPageView(
    site({ birth: BORN, milestones: [{ emoji: asEmoji('🩺'), label: { en: 'Scan' }, date: asDay('2026-04-02') }] }),
    'en',
    NOW
  );
  expect(JSON.parse(JSON.stringify(view))).toStrictEqual(view);
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
      const waiting = publicPageView(site({ dueDate: asDay('2026-10-20') }), lang, now).waiting;
      expect(waiting?.count).toBe(days);
      expect(waiting?.week).toStrictEqual({ number: week, label: `${lang === 'en' ? 'Week' : 'Settimana'} ${week}` });
      expect(waiting?.lateScene).toBeTruthy();
    }
  }
});
