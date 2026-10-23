'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type SubmitEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { PageShell } from '@/components/ui/PageShell';
import { Stack } from '@/components/ui/Stack';
import { StatusMessage } from '@/components/ui/StatusMessage';
import styles from './CredentialsForm.module.css';

const MODES = {
  login: {
    title: 'Log in',
    description: 'Welcome back! Your page has missed you.',
    endpoint: '/api/auth/login',
    next: '/admin',
    passwordAutoComplete: 'current-password',
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
    passwordAutoComplete: 'new-password',
    submit: 'Sign up',
    submitting: 'Creating account…',
    switchPrompt: 'Already have an account?',
    switchLink: { href: '/login', label: 'Log in' },
  },
} as const;

/** The email and password form of the login and signup pages. */
export function CredentialsForm({ mode }: { mode: keyof typeof MODES }) {
  const copy = MODES[mode];
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(copy.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }
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
            <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined} required>
              <Input
                name="password"
                type="password"
                autoComplete={copy.passwordAutoComplete}
                minLength={mode === 'signup' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
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
