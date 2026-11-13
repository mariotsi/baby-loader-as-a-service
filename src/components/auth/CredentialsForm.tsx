'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useLang } from '@/components/LangProvider';
import { LoginBaby, type LoginBabyState } from '@/components/LoginBaby';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { PageShell } from '@/components/ui/PageShell';
import { Stack } from '@/components/ui/Stack';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { errorsCopy } from '@/lib/copy/errors';
import { platformCopy } from '@/lib/copy/platform';
import { routeErrorText } from '@/lib/errorText';
import { type NewPasswordValues, signupFormSchema } from '@/lib/passwordRules';
import styles from './CredentialsForm.module.css';
import { adoptScreenValues, NewPasswordFields, rememberCredentials } from './NewPasswordFields';

/** What the form holds. Login leaves the confirmation empty and checks nothing: the server answers. */
type Credentials = NewPasswordValues & { email: string };

const signupResolver = zodResolver(signupFormSchema);

/** Where each mode sends the form and goes next; its words are in the Platform's dictionary (`auth`). */
const MODES = {
  login: { endpoint: '/api/auth/login', next: '/dashboard', switchHref: '/signup' },
  signup: { endpoint: '/api/auth/signup', next: '/onboarding', switchHref: '/login' },
} as const;

/**
 * Where the end of the typed email sits across the field, from -1 at its
 * start to 1 at its end, for the baby's eyes. An email field reports no
 * caret position, so this measures the text in the field's own font.
 */
function textEnd(input: HTMLInputElement): number {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) {
    return 0;
  }
  const style = getComputedStyle(input);
  context.font = style.font;
  const room = input.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
  const ratio = room > 0 ? context.measureText(input.value).width / room : 0;
  return Math.min(1, ratio) * 2 - 1;
}

/** The email and password form of the login and signup pages. */
export function CredentialsForm({ mode }: { mode: keyof typeof MODES }) {
  const route = MODES[mode];
  const router = useRouter();
  const lang = useLang();
  const t = platformCopy[lang].auth;
  const copy = t[mode];
  const [baby, setBaby] = useState<LoginBabyState>('sleeping');
  const [look, setLook] = useState(-1);
  const watchEmail = (input: HTMLInputElement) => {
    setBaby('watching');
    setLook(textEnd(input));
  };
  const form = useForm<Credentials>({
    defaultValues: { email: '', password: '', 'confirm-password': '' },
    resolver: mode === 'signup' ? signupResolver : undefined,
  });
  const { register, handleSubmit, setError, formState } = form;
  // router.push returns before the next page arrives; its transition stays pending until then.
  const [navigating, startNavigation] = useTransition();
  const busy = formState.isSubmitting || navigating;

  async function send({ email, password }: Credentials) {
    try {
      const res = await fetch(route.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError('root.server', { message: routeErrorText(data.error, lang) });
        return;
      }
      await rememberCredentials(email, password);
      startNavigation(() => {
        router.push(route.next);
        router.refresh();
      });
    } catch {
      setError('root.server', { message: errorsCopy[lang].generic });
    }
  }

  return (
    <PageShell width="narrow">
      {mode === 'login' ? (
        <div className={styles.baby}>
          <LoginBaby state={baby} look={look} />
        </div>
      ) : null}
      <Card title={copy.title} description={copy.description} headingLevel={1}>
        <FormProvider {...form}>
          <form
            onSubmit={(e) => {
              adoptScreenValues(e.currentTarget, form);
              void handleSubmit(send)(e);
            }}
          >
            <Stack gap={5}>
              <Field label={t.email} required>
                <Input
                  type="email"
                  autoComplete="username"
                  onFocus={mode === 'login' ? (e) => watchEmail(e.target) : undefined}
                  {...register(
                    'email',
                    mode === 'login' ? { onChange: (e) => watchEmail(e.target), onBlur: () => setBaby('awake') } : {}
                  )}
                />
              </Field>
              {mode === 'signup' ? (
                <NewPasswordFields />
              ) : (
                <Field label={t.password} required>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    onFocus={() => setBaby('covering')}
                    {...register('password', { onBlur: () => setBaby('awake') })}
                  />
                </Field>
              )}
              <StatusMessage tone="danger">{formState.errors.root?.server?.message}</StatusMessage>
              <Button variant="primary" type="submit" fullWidth loading={busy}>
                {busy ? copy.submitting : copy.submit}
              </Button>
            </Stack>
          </form>
        </FormProvider>
        <p className={styles.switch}>
          {copy.switchPrompt} <Link href={route.switchHref}>{copy.switchLink}</Link>
        </p>
      </Card>
    </PageShell>
  );
}
