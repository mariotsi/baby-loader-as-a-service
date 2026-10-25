'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type RefObject, type SubmitEvent, useId, useRef, useState, useTransition } from 'react';
import { useLang } from '@/components/LangProvider';
import { LoginBaby, type LoginBabyState } from '@/components/LoginBaby';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checklist } from '@/components/ui/Checklist';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { PageShell } from '@/components/ui/PageShell';
import { Stack } from '@/components/ui/Stack';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { errorsCopy } from '@/lib/copy/errors';
import { type PlatformCopy, platformCopy } from '@/lib/copy/platform';
import { routeErrorText } from '@/lib/errorText';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  PASSWORD_RULES_ATTRIBUTE,
  type PasswordRuleId,
  unmetPasswordRules,
} from '@/lib/passwordRules';
import styles from './CredentialsForm.module.css';

/** Where each mode sends the form and goes next; its words are in the Platform's dictionary (`auth`). */
const MODES = {
  login: { endpoint: '/api/auth/login', next: '/dashboard', switchHref: '/signup' },
  signup: { endpoint: '/api/auth/signup', next: '/onboarding', switchHref: '/login' },
} as const;

type AuthCopy = PlatformCopy['auth'];

/** A password rule's words, as the checklist under the field shows them. */
function ruleLabel(id: PasswordRuleId, t: AuthCopy): string {
  const label = t.passwordRules[id];
  return typeof label === 'function' ? label(PASSWORD_MIN_LENGTH) : label;
}

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

/** What stops a new password from being sent, once the Owner has tried to send it. */
function newPasswordErrors(password: string, confirm: string, t: AuthCopy) {
  const unmet = unmetPasswordRules(password);
  let confirmError: string | undefined;
  if (confirm !== password) {
    confirmError = confirm ? t.passwordsDiffer : t.typeAgain;
  }
  return {
    password: unmet.length > 0 ? t.rulesNotMet(unmet.map((rule) => ruleLabel(rule.id, t)).join(', ')) : undefined,
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
  const t = platformCopy[useLang()].auth;
  const rulesId = useId();
  const errors = tried ? newPasswordErrors(password, confirm, t) : { password: undefined, confirm: undefined };
  // Spread, since React's input props do not know `passwordrules`; React passes it to the DOM as it is.
  const passwordRules = { passwordrules: PASSWORD_RULES_ATTRIBUTE };
  return (
    <>
      <div className={styles.newPassword}>
        <Field label={t.password} error={errors.password} errorForScreenReaders required>
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
          items={PASSWORD_RULES.map((rule) => ({ id: rule.id, label: ruleLabel(rule.id, t), met: rule.met(password) }))}
          flagUnmet={tried}
        />
      </div>
      <Field label={t.confirmPassword} error={errors.confirm}>
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
  const route = MODES[mode];
  const router = useRouter();
  const lang = useLang();
  const t = platformCopy[lang].auth;
  const copy = t[mode];
  const [email, setEmail] = useState('');
  const [baby, setBaby] = useState<LoginBabyState>('sleeping');
  const [look, setLook] = useState(-1);
  const watchEmail = (input: HTMLInputElement) => {
    setBaby('watching');
    setLook(textEnd(input));
  };
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

  /** On signup, whether the new password can be sent; otherwise it moves focus to what stops it. */
  function newPasswordReady(newPassword: string, newConfirm: string): boolean {
    setTried(true);
    const errors = newPasswordErrors(newPassword, newConfirm, t);
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
      const res = await fetch(route.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, password: values.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(routeErrorText(data.error, lang));
        return;
      }
      await rememberCredentials(values.email, values.password);
      startNavigation(() => {
        router.push(route.next);
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
      {mode === 'login' ? (
        <div className={styles.baby}>
          <LoginBaby state={baby} look={look} />
        </div>
      ) : null}
      <Card title={copy.title} description={copy.description} headingLevel={1}>
        <form onSubmit={onSubmit}>
          <Stack gap={5}>
            <Field label={t.email} required>
              <Input
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (mode === 'login') {
                    watchEmail(e.target);
                  }
                }}
                onFocus={mode === 'login' ? (e) => watchEmail(e.target) : undefined}
                onBlur={mode === 'login' ? () => setBaby('awake') : undefined}
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
              <Field label={t.password} required>
                <Input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setBaby('covering')}
                  onBlur={() => setBaby('awake')}
                />
              </Field>
            )}
            <StatusMessage tone="danger">{error}</StatusMessage>
            <Button variant="primary" type="submit" fullWidth loading={busy}>
              {busy ? copy.submitting : copy.submit}
            </Button>
          </Stack>
        </form>
        <p className={styles.switch}>
          {copy.switchPrompt} <Link href={route.switchHref}>{copy.switchLink}</Link>
        </p>
      </Card>
    </PageShell>
  );
}
