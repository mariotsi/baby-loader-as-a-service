import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { siteIdSchema, userIdSchema } from '@/db/ids';
import { slugSchema } from '@/lib/address';
import type { Site } from '@/lib/site';
import { memorySiteEditingPort } from '@/lib/siteEditingPort';
import { calendarDaySchema, defaultSiteSettings, emojiSchema, settingsPath } from '@/lib/siteSettings';
import { bornPlaceholderUrl } from '@/lib/websiteAssets';
import { SiteEditor } from './SiteEditor';

const refresh = vi.fn();
/** The Site's server, in memory: each test opens the editor on its own. */
let port: ReturnType<typeof memorySiteEditingPort>;
/** What the leave guard was last asked to guard: whether the page holds unsaved changes it could still save. */
let guarded = false;

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/lib/siteEditingPort', async (original) => ({
  ...(await original<typeof import('@/lib/siteEditingPort')>()),
  fetchSiteEditingPort: () => port,
}));
vi.mock('./useLeaveGuard', () => ({
  useLeaveGuard: (dirty: boolean) => {
    guarded = dirty;
    return { target: null, leave: () => {}, stay: () => {} };
  },
}));
// What surrounds the form draws previews and follows the scroll, which jsdom cannot lay out.
vi.mock('./EditorPreview', () => ({
  EditorPreview: ({ settings }: { settings: { babyName: string } }) => <p>preview of {settings.babyName}</p>,
}));
vi.mock('./SitePreviews', () => ({ SitePreviews: () => null }));
vi.mock('./usePhonePreview', () => ({ usePhonePreview: () => ({ open: false, toggle: () => {}, id: 'preview' }) }));
vi.mock('./useStuck', () => ({ useStuck: () => ({ marker: { current: null }, stuck: false }) }));
vi.mock('@/components/ui/SectionNav', () => ({ SectionNav: () => null }));
vi.mock('./BirthMediaEditor', () => ({
  birthVideoTitle: () => 'Birth video',
  useBirthMediaUrl: () => undefined,
  BirthMediaEditor: ({ only, onVideo }: { only: string; onVideo?: (file: File) => void }) =>
    only === 'video' ? (
      <button type="button" onClick={() => onVideo?.(new File(['x'], 'hello.mp4', { type: 'video/mp4' }))}>
        Pick a video
      </button>
    ) : null,
}));
// jsdom has no modal dialogs: the Birth dialog and its confirmations draw in place.
vi.mock('@/components/ui/FullPageDialog', () => ({
  FullPageDialog: ({
    title,
    children,
    actions,
    onSubmit,
  }: {
    title: string;
    children: React.ReactNode;
    actions: React.ReactNode;
    onSubmit: (e: React.FormEvent) => void;
  }) => (
    <form aria-label={title} onSubmit={onSubmit}>
      {children}
      {actions}
    </form>
  ),
}));
vi.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, title, confirmLabel, onConfirm }: Record<string, never>) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));
vi.mock('./NotificationPreviews', () => ({ NotificationPreviews: () => null }));
vi.mock('./PublicPagePreview', () => ({ PublicPagePreview: () => null }));

/** Emma's Site, Waiting, with one Milestone. */
const emma: Site = {
  ...defaultSiteSettings,
  id: siteIdSchema.parse('7a2e3d4c-5b6f-4071-9283-94a516b7c8d9'),
  ownerId: userIdSchema.parse('6f1d2c3b-4a5e-4f60-8172-839405a6b7c8'),
  slug: slugSchema.parse('emma'),
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  customDomain: null,
  customDomainVerified: false,
  babyName: 'Emma',
  sex: 'female',
  languages: ['en'],
  milestones: [
    { emoji: emojiSchema.parse('🩺'), label: { en: 'First scan' }, date: calendarDaySchema.parse('2026-08-01') },
  ],
};

beforeEach(() => {
  port = memorySiteEditingPort(emma, { notification: { sent: 3, removed: 0, total: 3 } });
  refresh.mockClear();
  sessionStorage.clear();
});

afterEach(() => vi.unstubAllGlobals());

function renderEditor(site: Site = emma) {
  render(
    <SiteEditor
      site={site}
      timeZones={['Europe/Rome', 'Europe/London']}
      address="https://emma.loading.baby"
      bornPlaceholderUrl={bornPlaceholderUrl('development')}
    />
  );
}

const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
const said = (text: string | RegExp) => screen.queryByText(text) !== null;
const UNSAVED = 'Unsaved changes';
const SAVED = 'Saved. Your page is up to date.';
const CHECK = /Check the fields marked in red\./;

test('the editor opens on the Site with nothing unsaved, and says what is unsaved as the Owner types', () => {
  renderEditor();
  expect(field(/^Name/).value).toBe('Emma');
  expect([said(UNSAVED), guarded]).toStrictEqual([false, false]);
  type(field(/^Name/), 'Sofia');
  expect(screen.getByText('preview of Sofia')).toBeTruthy();
  expect([said(UNSAVED), guarded]).toStrictEqual([true, true]);
  type(field(/^Name/), 'Emma');
  expect([said(UNSAVED), guarded]).toStrictEqual([false, false]);
});

test('a save sends what the form holds, says so, and leaves nothing unsaved', async () => {
  renderEditor();
  type(field(/^Name/), 'Sofia');
  save();
  expect(await screen.findByText(SAVED)).toBeTruthy();
  expect(port.calls).toStrictEqual(['saveSettings']);
  expect(port.site().babyName).toBe('Sofia');
  expect([said(UNSAVED), guarded]).toStrictEqual([false, false]);
  expect(refresh).toHaveBeenCalledTimes(1);
  // The next edit is unsaved against what was just saved, and the next save is not stale.
  type(field(/^Name/), 'Emma');
  expect(said(UNSAVED)).toBe(true);
  save();
  await waitFor(() => expect(port.site().babyName).toBe('Emma'));
  await waitFor(() => expect(said(UNSAVED)).toBe(false));
});

test('what stops a save is marked and nothing is sent; the marked fields are checked again as they change', async () => {
  renderEditor();
  fireEvent.click(screen.getByRole('button', { name: 'Add milestone' }));
  save();

  expect(await screen.findByText('Pick the day.')).toBeTruthy();
  expect(screen.getByText('Give this Milestone a label.')).toBeTruthy();
  expect(said(CHECK)).toBe(true);
  expect(port.calls).toStrictEqual([]);
  const second = within(screen.getByRole('group', { name: 'Milestone 2' }));
  await waitFor(() => expect(document.activeElement).toBe(second.getByLabelText('Date')));

  // A Place typed and never picked is wrong too, but it did not stop the last save: it stays unmarked.
  const place = within(screen.getByRole('group', { name: 'Milestone 1' })).getByRole('combobox');
  type(place, 'Via Ro');
  type(second.getByLabelText('Date'), '2026-09-01');
  await waitFor(() => expect(said('Pick the day.')).toBe(false));
  expect(said('Give this Milestone a label.')).toBe(true);
  type(second.getByLabelText('Label'), 'Second scan');
  await waitFor(() => expect(said(CHECK)).toBe(false));
  expect(place.getAttribute('aria-invalid')).toBeNull();

  // The next save finds the Place and marks it.
  save();
  await waitFor(() => expect(said(CHECK)).toBe(true));
  expect(place.getAttribute('aria-invalid')).toBe('true');
  expect(port.calls).toStrictEqual([]);
});

test('an error that hangs on another field goes when that field changes', async () => {
  renderEditor();
  fireEvent.click(screen.getByRole('checkbox', { name: /Italian|Italiano/ }));
  save();
  expect(await screen.findByText('Write this Milestone in Italian.')).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: /Italian|Italiano/ }));
  await waitFor(() => expect(said(CHECK)).toBe(false));
  expect(said('Write this Milestone in Italian.')).toBe(false);
});

test('what the Owner types while a save is on its way stays unsaved', async () => {
  renderEditor();
  type(field(/^Name/), 'Sofia');
  const release = port.holdNext();
  save();
  await waitFor(() => expect(screen.getByRole('button', { name: /Saving/ })).toBeTruthy());
  type(field(/^Due date/), '2026-12-24');
  act(() => release());

  await waitFor(() => expect(port.site().babyName).toBe('Sofia'));
  expect(port.site().dueDate).toBe(null);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy());
  expect(field(/^Due date/).value).toBe('2026-12-24');
  expect([said(UNSAVED), said(SAVED)]).toStrictEqual([true, false]);
  save();
  await waitFor(() => expect(port.site().dueDate).toBe('2026-12-24'));
  expect(await screen.findByText(SAVED)).toBeTruthy();
});

test('a picked Birth video is uploaded with the save, and is then saved', async () => {
  renderEditor();
  fireEvent.click(screen.getByRole('button', { name: 'Pick a video' }));
  expect(said(UNSAVED)).toBe(true);
  save();
  expect(await screen.findByText(SAVED)).toBeTruthy();
  expect(port.calls).toStrictEqual(['upload', 'saveSettings']);
  expect(said(UNSAVED)).toBe(false);
});

test('a save from a tab that missed a change elsewhere says so, offers to reload, and stops guarding', async () => {
  renderEditor();
  type(field(/^Name/), 'Sofia');
  port.changeElsewhere();
  save();
  expect(await screen.findByRole('button', { name: 'Reload' })).toBeTruthy();
  expect(port.site().babyName).toBe('Emma');
  expect([said(UNSAVED), guarded]).toStrictEqual([true, false]);
});

test('Site settings errors only the server finds show in the status message', async () => {
  renderEditor();
  type(field(/^Name/), 'Sofia');
  port.refuseNext({ ok: false, errors: [{ path: settingsPath('timezone'), code: 'invalidOption' }] });
  save();
  await waitFor(() =>
    expect(screen.getAllByRole('alert').some((alert) => /Time ?zone/i.test(alert.textContent ?? ''))).toBe(true)
  );
  expect(said(SAVED)).toBe(false);
});

test('announcing the birth from its dialog saves it, shows it on the page, and leaves the page’s other changes unsaved', async () => {
  renderEditor();
  type(field(/^Due date/), '2026-12-24');
  fireEvent.click(screen.getByRole('button', { name: 'Announce the birth' }));
  const dialog = within(await screen.findByRole('form', { name: /Emma/ }));
  type(dialog.getByLabelText('Birth date & time'), '2026-10-26T08:30');
  fireEvent.click(dialog.getByRole('button', { name: 'Announce the birth' }));
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: 'Announce the birth now?' })).getByRole('button', {
      name: 'Announce the birth',
    })
  );

  await waitFor(() => expect(screen.queryByRole('form', { name: /Emma/ })).toBeNull());
  expect(port.calls).toStrictEqual(['setBirth']);
  expect(port.site().birth.born).toBe(true);
  expect(port.site().dueDate).toBe(null);
  expect(screen.getByRole('button', { name: 'Edit the birth details' })).toBeTruthy();
  // The Birth milestone the server added is on the page, and is not an unsaved change; the Due date still is.
  expect(screen.getByRole('group', { name: 'Milestone 2' })).toBeTruthy();
  expect(said(UNSAVED)).toBe(true);
  type(field(/^Due date/), '');
  await waitFor(() => expect(said(UNSAVED)).toBe(false));
});
