import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { defaultSiteSettings } from '@/lib/siteSettings';
import { SendNotificationForm } from './SendNotificationForm';

vi.mock('next/link', () => ({ default: ({ children }: { children: unknown }) => children }));

/** What the form sent, as the body of each request. */
let sent: unknown[];
/** What the server answers the next request with. */
let answer: { status: number; body: unknown };

beforeEach(() => {
  sent = [];
  answer = { status: 200, body: { sent: 12, total: 12 } };
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return Promise.resolve(Response.json(answer.body, { status: answer.status }));
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

function renderForm() {
  render(
    <SendNotificationForm
      slug="emma"
      site={{ ...defaultSiteSettings, babyName: 'Emma', languages: ['it', 'en'] }}
      icon="/icon-192.png"
      host="emma.loading.baby"
      subscribers={12}
      subscriptionsHref="/dashboard/emma/subscriptions"
      born
    />
  );
}

/** The control of one Language in the group labelled `group`. */
const control = (group: RegExp, language: string) =>
  within(screen.getByRole('group', { name: group })).getByRole('textbox', { name: language }) as HTMLInputElement;
const message = (language: string) => control(/^Message/, language);
const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Send notification' }));

test('a send without a message in every Language sends nothing and says which ones are missing', async () => {
  renderForm();
  type(message('English'), 'Here we go');
  expect(screen.queryByText('Every language needs a message.')).toBeNull();
  submit();

  expect(await screen.findByText('Write the message in Italian.')).toBeTruthy();
  expect(screen.queryByText('Write the message in English.')).toBeNull();
  expect(screen.getByText('Every language needs a message.')).toBeTruthy();
  expect(document.activeElement).toBe(message('Italian'));
  expect(sent).toStrictEqual([]);

  // The error goes away as soon as the message is written, without another send.
  type(message('Italian'), 'Ci siamo');
  await waitFor(() => expect(screen.queryByText('Write the message in Italian.')).toBeNull());
  expect(screen.queryByText('Every language needs a message.')).toBeNull();
});

test('a send posts each Language trimmed, a title only where one is written, and empties the form', async () => {
  renderForm();
  type(control(/^Title/, 'Italian'), ' Novità ');
  type(message('Italian'), ' Ci siamo ');
  type(message('English'), 'Here we go');
  submit();

  expect(await screen.findByText('Sent to 12 of 12 subscribers.')).toBeTruthy();
  expect(sent).toStrictEqual([
    { slug: 'emma', messages: { it: { title: 'Novità', body: 'Ci siamo' }, en: { body: 'Here we go' } } },
  ]);
  await waitFor(() => expect(message('Italian').value).toBe(''));
  expect(control(/^Title/, 'Italian').value).toBe('');

  // The emptied form starts over: nothing is red until the next send.
  expect(screen.queryByText('Every language needs a message.')).toBeNull();
  submit();
  expect(await screen.findByText('Every language needs a message.')).toBeTruthy();
  expect(sent).toHaveLength(1);
});

test('what the server refuses shows beside the button, keeps the texts, and clears on the next send', async () => {
  renderForm();
  type(message('Italian'), 'Ci siamo');
  type(message('English'), 'Here we go');
  answer = { status: 429, body: { error: { code: 'rateLimited' } } };
  submit();
  const refusal = await screen.findByRole('alert');
  await waitFor(() => expect(refusal.textContent).not.toBe(''));
  const words = refusal.textContent;
  expect(message('Italian').value).toBe('Ci siamo');

  answer = { status: 200, body: { sent: 11, total: 12 } };
  submit();
  await waitFor(() => expect(screen.queryByText(words ?? '')).toBeNull());
  expect(sent).toHaveLength(2);
});
