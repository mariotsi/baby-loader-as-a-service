'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type RefObject, type SubmitEvent, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checklist } from '@/components/ui/Checklist';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { PageShell } from '@/components/ui/PageShell';
import { Stack } from '@/components/ui/Stack';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { PASSWORD_RULES, PASSWORD_RULES_ATTRIBUTE, unmetPasswordRules } from '@/lib/passwordRules';
import styles from './CredentialsForm.module.css';

const MODES = {
  login: {
    title: 'Log in',
    description: 'Welcome back! Your page has missed you.',
    endpoint: '/api/auth/login',
    next: '/admin',
    submit: 'Log in',
    submitting: 'Logging in…',
    switchPrompt: 'No account yet?',
    switchLink: { href: '/signup', label: 'Sign up' },
  },
  signup: {
    title: 'Create your account',
    description: "You'll create your first waiting page next.",
    endpoint: '/api/auth/signup',
    next: '/onboarding',
    submit: 'Sign up',
    submitting: 'Creating account…',
    switchPrompt: 'Already have an account?',
    switchLink: { href: '/login', label: 'Log in' },
  },
} as const;

/**
 * Asks the browser to save the credentials once the server took them. The
 * page moves on without a full reload, so browsers that offer to save on a
 * real form submit would otherwise miss it. Chromium browsers support it;
 * elsewhere it does nothing.
 */
async function rememberCredentials(email: string, password: string) {
  // Not in TypeScript's DOM types: the Credential Management API is Chromium only.
  const PasswordCredential = (
    window as unknown as { PasswordCredential?: new (data: { id: string; password: string }) => Credential }
  ).PasswordCredential;
  if (!PasswordCredential) {
    return;
  }
  try {
    await navigator.credentials.store(new PasswordCredential({ id: email, password }));
  } catch {
    // Saving is a convenience: a refusal changes nothing for the Owner.
  }
}

/**
 * What the fields hold, read from the form itself. Some password managers
 * fill a field without the input event React listens to, so the state can
 * lag behind what the Owner sees; a submit trusts what is on screen.
 */
function fieldValues(form: HTMLFormElement) {
  const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
  return { email: value('email'), password: value('password'), confirm: value('confirm-password') };
}

/** What stops a new password from being sent, once the Owner has tried to send it. */
function newPasswordErrors(password: string, confirm: string) {
  const unmet = unmetPasswordRules(password);
  let confirmError: string | undefined;
  if (confirm !== password) {
    confirmError = confirm
      ? "The passwords don't match. Type the same password again."
      : 'Type your password again here.';
  }
  return {
    password: unmet.length > 0 ? `Not met yet: ${unmet.map((rule) => rule.label).join(', ')}.` : undefined,
    confirm: confirmError,
  };
}

/**
 * The new password, its rules ticking off as the Owner types, and its
 * confirmation. Both fields are marked `new-password`, which is how password
 * managers tell a signup form and fill both with the password they suggest;
 * `passwordrules` tells them what that password must contain.
 */
function NewPasswordFields({
  password,
  onPassword,
  confirm,
  onConfirm,
  tried,
  passwordRef,
  confirmRef,
}: {
  password: string;
  onPassword: (value: string) => void;
  confirm: string;
  onConfirm: (value: string) => void;
  tried: boolean;
  passwordRef: RefObject<HTMLInputElement | null>;
  confirmRef: RefObject<HTMLInputElement | null>;
}) {
  const rulesId = useId();
  const errors = tried ? newPasswordErrors(password, confirm) : { password: undefined, confirm: undefined };
  // Spread, since React's input props do not know `passwordrules`; React passes it to the DOM as it is.
  const passwordRules = { passwordrules: PASSWORD_RULES_ATTRIBUTE };
  return (
    <>
      <div className={styles.newPassword}>
        <Field label="Password" error={errors.password} errorForScreenReaders required>
          <Input
            ref={passwordRef}
            name="password"
            type="password"
            autoComplete="new-password"
            {...passwordRules}
            aria-describedby={rulesId}
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            onBlur={(e) => onPassword(e.target.value)}
          />
        </Field>
        <Checklist
          id={rulesId}
          items={PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, met: rule.met(password) }))}
          flagUnmet={tried}
        />
      </div>
      <Field label="Confirm password" error={errors.confirm}>
        <Input
          ref={confirmRef}
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          {...passwordRules}
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
          onBlur={(e) => onConfirm(e.target.value)}
        />
      </Field>
    </>
  );
}

/** The email and password form of the login and signup pages. */
export function CredentialsForm({ mode }: { mode: keyof typeof MODES }) {
  const copy = MODES[mode];
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  /** On signup, whether the new password can be sent; otherwise it moves focus to what stops it. */
  function newPasswordReady(newPassword: string, newConfirm: string): boolean {
    setTried(true);
    const errors = newPasswordErrors(newPassword, newConfirm);
    if (errors.password) {
      passwordRef.current?.focus();
    } else if (errors.confirm) {
      confirmRef.current?.focus();
    }
    return !(errors.password || errors.confirm);
  }

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const values = fieldValues(e.currentTarget);
    setEmail(values.email);
    setPassword(values.password);
    setConfirm(values.confirm);
    if (mode === 'signup' && !newPasswordReady(values.password, values.confirm)) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(copy.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, password: values.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }
      await rememberCredentials(values.email, values.password);
      router.push(copy.next);
      router.refresh();
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell width="narrow">
      <Card title={copy.title} description={copy.description} headingLevel={1}>
        <form onSubmit={onSubmit}>
          <Stack gap={5}>
            <Field label="Email" required>
              <Input
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {mode === 'signup' ? (
              <NewPasswordFields
                password={password}
                onPassword={setPassword}
                confirm={confirm}
                onConfirm={setConfirm}
                tried={tried}
                passwordRef={passwordRef}
                confirmRef={confirmRef}
              />
            ) : (
              <Field label="Password" required>
                <Input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
            <StatusMessage tone="danger">{error}</StatusMessage>
            <Button variant="primary" type="submit" fullWidth loading={loading}>
              {loading ? copy.submitting : copy.submit}
            </Button>
          </Stack>
        </form>
        <p className={styles.switch}>
          {copy.switchPrompt} <Link href={copy.switchLink.href}>{copy.switchLink.label}</Link>
        </p>
      </Card>
    </PageShell>
  );
}
