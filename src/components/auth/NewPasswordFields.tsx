'use client';

import { type RefObject, useId } from 'react';
import { useLang } from '@/components/LangProvider';
import { Checklist } from '@/components/ui/Checklist';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { type PlatformCopy, platformCopy } from '@/lib/copy/platform';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  PASSWORD_RULES_ATTRIBUTE,
  type PasswordRuleId,
  unmetPasswordRules,
} from '@/lib/passwordRules';
import styles from './CredentialsForm.module.css';

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
export async function rememberCredentials(email: string, password: string) {
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

/** What stops a new password from being sent, once the Owner has tried to send it. */
export function newPasswordErrors(password: string, confirm: string, t: AuthCopy) {
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
export function NewPasswordFields({
  label,
  password,
  onPassword,
  confirm,
  onConfirm,
  tried,
  passwordRef,
  confirmRef,
}: {
  /** The new password's label, `Password` unless given. */
  label?: string;
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
        <Field label={label ?? t.password} error={errors.password} errorForScreenReaders required>
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
