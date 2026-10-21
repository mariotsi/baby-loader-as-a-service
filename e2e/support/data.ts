/**
 * The test data every E2E run relies on, shared by the data script
 * (scripts/e2e-data.mjs, run by plain node) and the specs, so the two can
 * never disagree on a Slug or an email. Plain TypeScript with explicit
 * extensions only: node strips the types itself.
 */

/** Reserved for documentation and testing (RFC 2606), so no mail ever leaves. */
export const TEST_EMAIL_DOMAIN = 'waitingpages.test';

/** Playwright projects. A fixture a test changes exists once per project, so parallel projects never share it. */
export const PROJECTS = ['desktop', 'iphone'] as const;
export type ProjectName = (typeof PROJECTS)[number];

export type Owner = 'a' | 'b';

export const FIXTURE_OWNERS: Record<Owner, string> = {
  a: `e2e-owner-a@${TEST_EMAIL_DOMAIN}`,
  b: `e2e-owner-b@${TEST_EMAIL_DOMAIN}`,
};

export type SiteSpec = {
  slug: string;
  owner: Owner;
  babyName: string;
  sex: 'female' | 'male' | 'unknown';
  language: 'it' | 'en' | 'both';
  showName: boolean;
  showSex: boolean;
  /** Days from today to the Due date; null for no Due date. */
  dueInDays: number | null;
  /** Set for the Born state: how many days ago the baby was born. */
  bornDaysAgo?: number;
  weight?: number;
  lengthCm?: number;
  /** The Birth message in each language that has one. */
  birthMessage?: { it?: string; en?: string };
  milestones?: { label: string; inDays: number }[];
};

const waiting = {
  sex: 'female',
  language: 'en',
  showName: true,
  showSex: true,
  dueInDays: 30,
} as const;

/** Sites tests only read. */
const sharedFixtureSites: SiteSpec[] = [
  {
    ...waiting,
    slug: 'e2e-waiting',
    owner: 'a',
    babyName: 'Wanda',
    milestones: [{ label: 'First scan', inDays: -60 }],
  },
  {
    ...waiting,
    slug: 'e2e-born',
    owner: 'a',
    babyName: 'Bruno',
    sex: 'male',
    dueInDays: -3,
    bornDaysAgo: 2,
    weight: 3250,
    lengthCm: 50,
    birthMessage: { en: 'Everyone is doing well.' },
  },
  { ...waiting, slug: 'e2e-private', owner: 'a', babyName: 'Priscilla', showName: false, showSex: false },
  { ...waiting, slug: 'e2e-both', owner: 'a', babyName: 'Bianca', language: 'both' },
  { ...waiting, slug: 'e2e-owner-b', owner: 'b', babyName: 'Beatrice' },
];

/** Sites a test changes: one per project, named `<base>-<project>`. */
const perProjectFixtureBases: Omit<SiteSpec, 'slug'>[] = [
  { ...waiting, owner: 'a', babyName: 'Edith' },
  { ...waiting, owner: 'a', babyName: 'Nora' },
  { ...waiting, owner: 'a', babyName: 'Ruth' },
  { ...waiting, owner: 'a', babyName: 'Marta', language: 'both' },
];
const PER_PROJECT_BASES = ['e2e-edit', 'e2e-notify', 'e2e-rules', 'e2e-messages'] as const;
export type PerProjectFixture = (typeof PER_PROJECT_BASES)[number];

export function perProjectSlug(base: PerProjectFixture, project: ProjectName): string {
  return `${base}-${project}`;
}

export const FIXTURE_SITES: SiteSpec[] = [
  ...sharedFixtureSites,
  ...PER_PROJECT_BASES.flatMap((base, i) =>
    PROJECTS.map((project) => ({ ...perProjectFixtureBases[i], slug: perProjectSlug(base, project) }))
  ),
];

export function fixtureSite(slug: string): SiteSpec {
  const site = FIXTURE_SITES.find((s) => s.slug === slug);
  if (!site) {
    throw new Error(`No fixture Site "${slug}"`);
  }
  return site;
}

/** Demo data for people reviewing a preview by hand; never written to staging. */
export const DEMO_OWNERS: Record<Owner, string> = {
  a: `demo-owner-a@${TEST_EMAIL_DOMAIN}`,
  b: `demo-owner-b@${TEST_EMAIL_DOMAIN}`,
};

export const DEMO_SITES: SiteSpec[] = [
  {
    ...waiting,
    slug: 'demo-emma',
    owner: 'a',
    babyName: 'Emma',
    language: 'both',
    dueInDays: 45,
    milestones: [
      { label: 'First scan', inDays: -90 },
      { label: 'Baby shower', inDays: 20 },
    ],
  },
  {
    ...waiting,
    slug: 'demo-leo',
    owner: 'a',
    babyName: 'Leo',
    sex: 'male',
    language: 'it',
    dueInDays: -5,
    bornDaysAgo: 4,
    weight: 3480,
    lengthCm: 52,
    birthMessage: { it: 'Mamma e bimbo stanno bene!' },
  },
  { ...waiting, slug: 'demo-sofia', owner: 'a', babyName: 'Sofia', showName: false, showSex: false, dueInDays: 80 },
  { ...waiting, slug: 'demo-nina', owner: 'b', babyName: 'Nina', dueInDays: 12 },
];

/**
 * Users and Sites a run creates carry `e2e-run-<runId>-` in their email and
 * Slug, so the run's cleanup finds exactly them. A Slug holds at most 32
 * characters: the prefix takes 15, leaving 17 for the suffix.
 */
export const RUN_PREFIX = 'e2e-run-';

export function runSlug(runId: string, suffix: string): string {
  return `${RUN_PREFIX}${runId}-${suffix}`;
}

export function runEmail(runId: string, suffix: string): string {
  return `${RUN_PREFIX}${runId}-${suffix}@${TEST_EMAIL_DOMAIN}`;
}
