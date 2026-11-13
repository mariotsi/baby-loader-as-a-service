'use client';

import { useId } from 'react';
import {
  type FieldValues,
  type Path,
  type UseFormReturn,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';
import { useLang } from '@/components/LangProvider';
import { Checklist } from '@/components/ui/Checklist';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { type PlatformCopy, platformCopy } from '@/lib/copy/platform';
import {
  type NewPasswordProblem,
  type NewPasswordValues,
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

/**
 * Copies what the form's fields show into `form` before a submit. Some
 * password managers fill a field without the input event the form listens
 * to, so its values can lag behind what the Owner sees; a submit trusts what
 * is on screen.
 */
export function adoptScreenValues<T extends FieldValues>(
  element: HTMLFormElement,
  { getValues, setValue }: Pick<UseFormReturn<T>, 'getValues' | 'setValue'>
) {
  for (const name of Object.keys(getValues()) as Path<T>[]) {
    const field = element.elements.namedItem(name);
    if (field instanceof HTMLInputElement && field.value !== getValues(name)) {
      setValue(name, field.value as Parameters<typeof setValue>[1]);
    }
  }
}

/**
 * The new password, its rules ticking off as the Owner types, and its
 * confirmation, as fields of the form around them (a `FormProvider` whose
 * values include `NewPasswordValues`, checked by one of the schemas in
 * `passwordRules.ts`). Both fields are marked `new-password`, which is how
 * password managers tell a signup form and fill both with the password they
 * suggest; `passwordrules` tells them what that password must contain.
 *
 * Nothing turns red before the first submit. After it each field is checked
 * again as it changes, and on blur, which is when the form learns of a value
 * a password manager filled silently.
 */
export function NewPasswordFields({
  label,
}: {
  /** The new password's label, `Password` unless given. */
  label?: string;
}) {
  const t = platformCopy[useLang()].auth;
  const rulesId = useId();
  const { register, control, trigger } = useFormContext<NewPasswordValues>();
  const { errors, isSubmitted } = useFormState({ control });
  const password = useWatch({ control, name: 'password' });
  const recheck = () => {
    if (isSubmitted) {
      void trigger(['password', 'confirm-password']);
    }
  };
  const unmet = unmetPasswordRules(password).map((rule) => ruleLabel(rule.id, t));
  const confirmProblem = errors['confirm-password']?.message as Exclude<NewPasswordProblem, 'rulesNotMet'> | undefined;
  // Spread, since React's input props do not know `passwordrules`; React passes it to the DOM as it is.
  const passwordRules = { passwordrules: PASSWORD_RULES_ATTRIBUTE };
  return (
    <>
      <div className={styles.newPassword}>
        <Field
          label={label ?? t.password}
          error={errors.password && unmet.length > 0 ? t.rulesNotMet(unmet.join(', ')) : undefined}
          errorForScreenReaders
          required
        >
          <Input
            type="password"
            autoComplete="new-password"
            {...passwordRules}
            aria-describedby={rulesId}
            {...register('password', { deps: ['confirm-password'], onBlur: recheck })}
          />
        </Field>
        <Checklist
          id={rulesId}
          items={PASSWORD_RULES.map((rule) => ({ id: rule.id, label: ruleLabel(rule.id, t), met: rule.met(password) }))}
          flagUnmet={isSubmitted}
        />
      </div>
      <Field label={t.confirmPassword} error={confirmProblem ? t[confirmProblem] : undefined}>
        <Input
          type="password"
          autoComplete="new-password"
          {...passwordRules}
          {...register('confirm-password', { onBlur: recheck })}
        />
      </Field>
    </>
  );
}
