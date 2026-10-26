'use client';

import { useRouter } from 'next/navigation';
import { type SubmitEvent, useRef, useState, useTransition } from 'react';
import { useLang } from '@/components/LangProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageShell } from '@/components/ui/PageShell';
import { Stack } from '@/components/ui/Stack';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { errorsCopy } from '@/lib/copy/errors';
import { platformCopy } from '@/lib/copy/platform';
import { routeErrorText } from '@/lib/errorText';
import { NewPasswordFields, newPasswordErrors, rememberCredentials } from './NewPasswordFields';

/**
 * The change-password page's form: a new password, its confirmation, and on
 * success the Dashboard. `pending` says the login asked for the change.
 */
export function ChangePasswordForm({ email, pending }: { email: string; pending: boolean }) {
  const router = useRouter();
  const lang = useLang();
  const t = platformCopy[lang].auth;
  const copy = t.changePassword;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // router.push returns before the next page arrives; its transition stays pending until then.
  const [navigating, startNavigation] = useTransition();
  const busy = loading || navigating;
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    // Some password managers fill a field without the input event React listens to: the submit trusts what is on screen.
    const form = e.currentTarget;
    const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
    const newPassword = value('password');
    const newConfirm = value('confirm-password');
    setPassword(newPassword);
    setConfirm(newConfirm);
    setTried(true);
    const errors = newPasswordErrors(newPassword, newConfirm, t);
    if (errors.password || errors.confirm) {
      (errors.password ? passwordRef : confirmRef).current?.focus();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        setError(routeErrorText((await res.json()).error, lang));
        return;
      }
      await rememberCredentials(email, newPassword);
      startNavigation(() => {
        router.push('/dashboard');
        router.refresh();
      });
    } catch {
      setError(errorsCopy[lang].generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell width="narrow">
      <Card title={copy.title} description={pending ? copy.pendingDescription : copy.description} headingLevel={1}>
        <form onSubmit={onSubmit}>
          <Stack gap={5}>
            {/* Tells password managers whose saved password the new one replaces. */}
            <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
            <NewPasswordFields
              label={t.newPassword}
              password={password}
              onPassword={setPassword}
              confirm={confirm}
              onConfirm={setConfirm}
              tried={tried}
              passwordRef={passwordRef}
              confirmRef={confirmRef}
            />
            <StatusMessage tone="danger">{error}</StatusMessage>
            <Button variant="primary" type="submit" fullWidth loading={busy}>
              {busy ? copy.submitting : copy.submit}
            </Button>
          </Stack>
        </form>
      </Card>
    </PageShell>
  );
}
