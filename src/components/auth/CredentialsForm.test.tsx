import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ChangePasswordForm } from './ChangePasswordForm';
import { CredentialsForm } from './CredentialsForm';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('next/link', () => ({ default: ({ children }: { children: unknown }) => children }));
// The shell draws an animated background, which asks the browser about motion: jsdom has no answer.
vi.mock('@/components/ui/PageShell', () => ({ PageShell: ({ children }: { children: unknown }) => children }));
vi.mock('@/components/LoginBaby', () => ({ LoginBaby: ({ state }: { state: string }) => <p>baby {state}</p> }));

/** Meets every rule in src/lib/passwordRules.ts. */
const GOOD = 'A-brand-new-passw0rd';

/** What the form sent, as `[url, body]` for each request. */
let sent: [string, unknown][];
/** What the server answers the next request with. */
let answer: { status: number; body: unknown };

beforeEach(() => {
  sent = [];
  answer = { status: 200, body: {} };
  push.mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      sent.push([url, JSON.parse(String(init.body))]);
      return Promise.resolve(Response.json(answer.body, { status: answer.status }));
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

const field = (label: string) =>
  screen.getByLabelText(new RegExp(`^${label}`), { selector: 'input' }) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const submit = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
/** Sets a field's value the way some password managers do: with no event for the form to hear. */
const fillSilently = (label: string, value: string) => {
  field(label).value = value;
};

test('signup sends nothing until the password meets every rule and is typed twice the same', async () => {
  render(<CredentialsForm mode="signup" />);
  type('Email', 'ada@example.com');
  type('Password', 'abcdefghij1');
  type('Confirm password', 'something else');
  expect(screen.queryByText(/don't match/)).toBeNull();
  submit('Sign up');

  expect(await screen.findByText("The passwords don't match. Type the same password again.")).toBeTruthy();
  expect(screen.getByText('Not met yet: An uppercase letter, A symbol, such as ! ? @ # $ % & * - _.')).toBeTruthy();
  expect(document.activeElement).toBe(field('Password'));

  // Each field is checked again as it changes; the password's change rechecks its confirmation too.
  type('Password', GOOD);
  await waitFor(() => expect(screen.queryByText(/Not met yet/)).toBeNull());
  type('Confirm password', '');
  expect(await screen.findByText('Type your password again here.')).toBeTruthy();
  submit('Sign up');
  await waitFor(() => expect(document.activeElement).toBe(field('Confirm password')));
  type('Password', `${GOOD}!`);
  type('Confirm password', GOOD);
  type('Password', GOOD);
  await waitFor(() => expect(screen.queryByText(/don't match/)).toBeNull());
  expect(sent).toStrictEqual([]);

  submit('Sign up');
  await waitFor(() => expect(push).toHaveBeenCalledWith('/onboarding'));
  expect(sent).toStrictEqual([['/api/auth/signup', { email: 'ada@example.com', password: GOOD }]]);
});

test('signup takes what a password manager fills without telling the form, on blur and on submit', async () => {
  render(<CredentialsForm mode="signup" />);
  type('Email', 'ada@example.com');
  type('Password', GOOD);
  type('Confirm password', 'mistyped');
  submit('Sign up');
  expect(await screen.findByText(/don't match/)).toBeTruthy();

  fillSilently('Confirm password', GOOD);
  fireEvent.blur(field('Confirm password'));
  await waitFor(() => expect(screen.queryByText(/don't match/)).toBeNull());

  fillSilently('Password', `${GOOD}x`);
  fillSilently('Confirm password', `${GOOD}x`);
  submit('Sign up');
  await waitFor(() => expect(push).toHaveBeenCalled());
  expect(sent[0][1]).toStrictEqual({ email: 'ada@example.com', password: `${GOOD}x` });
});

test('login checks nothing itself, shows what the server refuses, and clears it on the next try', async () => {
  render(<CredentialsForm mode="login" />);
  type('Email', 'ada@example.com');
  type('Password', 'short');
  answer = { status: 401, body: { error: { code: 'wrongCredentials' } } };
  submit('Log in');
  expect(await screen.findByText('Invalid email or password.')).toBeTruthy();
  expect(push).not.toHaveBeenCalled();

  answer = { status: 200, body: {} };
  submit('Log in');
  await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
  expect(screen.queryByText('Invalid email or password.')).toBeNull();
  expect(sent[1]).toStrictEqual(['/api/auth/login', { email: 'ada@example.com', password: 'short' }]);
});

test('login says so when no answer arrives', async () => {
  render(<CredentialsForm mode="login" />);
  type('Email', 'ada@example.com');
  type('Password', 'whatever');
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
  submit('Log in');
  expect(await screen.findByText(/Something went wrong/)).toBeTruthy();
});

test('the login baby watches the email, covers its eyes for the password, and wakes when the field is left', () => {
  render(<CredentialsForm mode="login" />);
  expect(screen.getByText('baby sleeping')).toBeTruthy();
  type('Email', 'a');
  expect(screen.getByText('baby watching')).toBeTruthy();
  fireEvent.blur(field('Email'));
  expect(screen.getByText('baby awake')).toBeTruthy();
  fireEvent.focus(field('Password'));
  expect(screen.getByText('baby covering')).toBeTruthy();
  fireEvent.blur(field('Password'));
  expect(screen.getByText('baby awake')).toBeTruthy();
});

test('changing the password checks it the same way and sends only the new password', async () => {
  render(<ChangePasswordForm email="ada@example.com" pending={false} />);
  type('New password', 'weak');
  submit('Save password');
  expect(await screen.findByText('Type your password again here.')).toBeTruthy();
  expect(document.activeElement).toBe(field('New password'));
  expect(sent).toStrictEqual([]);

  type('New password', GOOD);
  type('Confirm password', GOOD);
  answer = { status: 400, body: { error: { code: 'passwordRules' } } };
  submit('Save password');
  await waitFor(() => expect(sent).toStrictEqual([['/api/auth/password', { password: GOOD }]]));
  expect(push).not.toHaveBeenCalled();

  answer = { status: 200, body: {} };
  submit('Save password');
  await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
});
