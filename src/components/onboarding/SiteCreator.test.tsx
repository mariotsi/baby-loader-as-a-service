import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { addDays, format } from 'date-fns';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { addressConfig } from '@/lib/address';
import { bornPlaceholderUrl } from '@/lib/websiteAssets';
import { SiteCreator } from './SiteCreator';

const push = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
// The shell and the preview draw the page around the form, which jsdom cannot lay out.
vi.mock('@/components/ui/PageShell', () => ({ PageShell: ({ children }: { children: unknown }) => children }));
vi.mock('@/components/dashboard/EditorPreview', () => ({
  EditorPreview: ({ settings, slug }: { settings: { babyName: string; dueDate: string | null }; slug: string }) => (
    <p>
      preview of {slug}: {settings.babyName || 'no name'}, due {settings.dueDate ?? 'unknown'}
    </p>
  ),
}));

const DUE_MISSING = 'Pick the day your baby is due. A rough guess is fine, and you can change it later.';
const DUE = format(addDays(new Date(), 60), 'yyyy-MM-dd');

/** The Slugs the server says are taken. */
let taken: string[];
/** The bodies sent to create a Site. */
let created: { slug: string; settings: Record<string, unknown> }[];
/** What the server answers a creation with. */
let answer: { status: number; body: unknown };

beforeEach(() => {
  taken = [];
  created = [];
  answer = { status: 201, body: { site: { slug: 'emma' } } };
  push.mockClear();
  sessionStorage.clear();
  history.replaceState(null, '', '/onboarding');
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/slug-available')) {
        const slug = new URL(url, 'http://x').searchParams.get('slug') ?? '';
        return Promise.resolve(Response.json({ available: !taken.includes(slug) }));
      }
      created.push(JSON.parse(String(init?.body)));
      return Promise.resolve(Response.json(answer.body, { status: answer.status }));
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

function renderCreator() {
  render(
    <SiteCreator
      addressConfig={addressConfig({ ROOT_DOMAIN: 'loading.baby' })}
      bornPlaceholderUrl={bornPlaceholderUrl('development')}
    />
  );
}

const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const heading = (name: string) => screen.findByRole('heading', { name });
const focused = (element: HTMLElement) => waitFor(() => expect(document.activeElement).toBe(element));

test('The basics ask for an Address and a Due date, and check each again as it changes', async () => {
  renderCreator();
  expect(screen.getByText(/Your page will be at/)).toBeTruthy();
  press('Next');

  expect(await screen.findByText(DUE_MISSING)).toBeTruthy();
  await focused(field('Site address'));
  expect(field('Site address').getAttribute('aria-invalid')).toBe('true');

  // The Address is lowercased as typed, and says at once when it cannot be one.
  type('Site address', 'Emma Rose');
  expect(field('Site address').value).toBe('emma rose');
  expect(field('Site address').getAttribute('aria-invalid')).toBe('true');
  type('Site address', 'emma');
  await waitFor(() => expect(field('Site address').getAttribute('aria-invalid')).toBeNull());
  type('Due date', DUE);
  await waitFor(() => expect(screen.queryByText(DUE_MISSING)).toBeNull());
  expect(screen.getByText(`preview of emma: no name, due ${DUE}`)).toBeTruthy();
});

test('an Address someone else has stops The basics until it changes', async () => {
  renderCreator();
  taken = ['emma'];
  type('Site address', 'emma');
  type('Due date', DUE);
  press('Next');
  await waitFor(() => expect(field('Site address').getAttribute('aria-invalid')).toBe('true'));
  await focused(field('Site address'));
  expect(screen.queryByRole('heading', { name: 'Make it yours' })).toBeNull();

  type('Site address', 'emma-2027');
  await waitFor(() => expect(field('Site address').getAttribute('aria-invalid')).toBeNull());
  press('Next');
  await focused(await heading('Make it yours'));
  expect(location.search).toBe('?step=2');
});

test('the four steps create the Site with everything entered, and forget the draft', async () => {
  renderCreator();
  type('Site address', 'emma');
  type("Baby's name", 'Emma');
  fireEvent.change(screen.getByLabelText('Sex'), { target: { value: 'female' } });
  type('Due date', DUE);
  press('Next');
  await heading('Make it yours');
  type('Page name', 'Ada & Bea');
  await waitFor(() => expect(sessionStorage.getItem('new-site-draft')).toContain('Ada & Bea'));
  press('Next');
  await heading('Keep the secret');
  press('Next');
  await heading('A last look');
  expect(screen.getByText('Ada & Bea')).toBeTruthy();
  press('Create site');

  await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/emma'));
  expect(created).toHaveLength(1);
  expect(created[0].slug).toBe('emma');
  expect(created[0].settings).toMatchObject({
    babyName: 'Emma',
    sex: 'female',
    dueDate: DUE,
    pageName: { en: 'Ada & Bea' },
    birth: { born: false, details: null },
  });
  expect(sessionStorage.getItem('new-site-draft')).toBeNull();
});

test('a reload brings back the draft and the step, and Back keeps what was entered', async () => {
  renderCreator();
  type('Site address', 'emma');
  type("Baby's name", 'Emma');
  type('Due date', DUE);
  press('Next');
  await heading('Make it yours');
  await waitFor(() => expect(sessionStorage.getItem('new-site-draft')).toContain('"slug":"emma"'));
  const saved = sessionStorage.getItem('new-site-draft') ?? '';

  document.body.innerHTML = '';
  sessionStorage.setItem('new-site-draft', saved);
  renderCreator();
  await heading('Make it yours');
  press('Back');
  await waitFor(() => expect(field('Site address').value).toBe('emma'));
  expect(field("Baby's name").value).toBe('Emma');
  expect(field('Due date').value).toBe(DUE);
});

test('an Address the server refuses at the end goes back to The basics, under its field', async () => {
  renderCreator();
  type('Site address', 'emma');
  type('Due date', DUE);
  press('Next');
  await heading('Make it yours');
  press('Next');
  await heading('Keep the secret');
  press('Next');
  await heading('A last look');
  answer = { status: 409, body: { errors: [{ path: 'slug', code: 'slugTaken' }] } };
  press('Create site');

  await waitFor(() => expect(field('Site address').getAttribute('aria-invalid')).toBe('true'));
  await focused(field('Site address'));
  expect(push).not.toHaveBeenCalled();
});

test('any other refusal shows beside the button, and going to another step clears it', async () => {
  renderCreator();
  type('Site address', 'emma');
  type('Due date', DUE);
  for (const name of ['Make it yours', 'Keep the secret', 'A last look']) {
    press('Next');
    await heading(name);
  }
  answer = { status: 429, body: { error: { code: 'rateLimited' } } };
  press('Create site');
  const refusal = await screen.findByRole('alert');
  await waitFor(() => expect(refusal.textContent).not.toBe(''));

  press('Back');
  await heading('Keep the secret');
  expect(screen.getByRole('alert').textContent).toBe('');
});

test('a draft whose Due date no longer passes goes back to The basics from the last step', async () => {
  renderCreator();
  type('Site address', 'emma');
  type('Due date', DUE);
  for (const name of ['Make it yours', 'Keep the secret', 'A last look']) {
    press('Next');
    await heading(name);
  }
  const saved = JSON.parse(sessionStorage.getItem('new-site-draft') ?? '{}');
  document.body.innerHTML = '';
  sessionStorage.setItem('new-site-draft', JSON.stringify({ ...saved, dueDate: '2020-01-01' }));
  renderCreator();
  await heading('A last look');
  press('Create site');

  await focused(await waitFor(() => field('Due date')));
  expect(field('Due date').getAttribute('aria-invalid')).toBe('true');
  expect(created).toStrictEqual([]);
});
