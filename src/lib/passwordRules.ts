/**
 * What a new password must have. Signup checks it in the browser, ticking
 * each rule off as the Owner types, and the server checks it again. Login
 * never does: a password that was valid when it was set stays valid.
 */

import * as z from 'zod/mini';
import type { RouteError } from './routeError.ts';

export type PasswordRuleId = 'length' | 'lower' | 'upper' | 'digit' | 'symbol';

/** A rule's words, under the password field, are in the Platform's dictionary (`auth.passwordRules`). */
export interface PasswordRule {
  id: PasswordRuleId;
  met: (password: string) => boolean;
}

export const PASSWORD_MIN_LENGTH = 10;
/** Bounds the cost of hashing; long enough for any password manager. */
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', met: (p) => [...p].length >= PASSWORD_MIN_LENGTH },
  { id: 'lower', met: (p) => /\p{Ll}/u.test(p) },
  { id: 'upper', met: (p) => /\p{Lu}/u.test(p) },
  { id: 'digit', met: (p) => /\p{Nd}/u.test(p) },
  // Anything that is not a letter, a number or a space counts. A space is allowed, as any other character.
  { id: 'symbol', met: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
];

/** The symbols that meet the symbol rule, in the attribute's syntax: its `special` class, minus the space. */
const SYMBOLS = '[-~!@#$%^&*_+=`|(){}[:;"\'<>,.?]]';

/**
 * The rules in the `passwordrules` attribute's syntax, which Safari and some
 * password managers read to generate a password that passes them: it may
 * hold a space, but needs one of the symbols that are not.
 */
export const PASSWORD_RULES_ATTRIBUTE = `minlength: ${PASSWORD_MIN_LENGTH}; maxlength: ${PASSWORD_MAX_LENGTH}; required: lower; required: upper; required: digit; required: ${SYMBOLS}; allowed: lower, upper, digit, special;`;

export function unmetPasswordRules(password: string): PasswordRule[] {
  return PASSWORD_RULES.filter((rule) => !rule.met(password));
}

/** Why the server refuses a new password, or null when it takes it. */
export function newPasswordProblem(password: string): RouteError | null {
  if ([...password].length > PASSWORD_MAX_LENGTH) {
    return { code: 'passwordTooLong', params: { max: PASSWORD_MAX_LENGTH } };
  }
  return unmetPasswordRules(password).length > 0 ? { code: 'passwordRules' } : null;
}

/**
 * Why a form refuses a new password or its confirmation. Each is the message
 * of the issue the schemas below report, and a key of the Platform's
 * dictionary (`auth`), where the form finds its words.
 */
export type NewPasswordProblem = 'rulesNotMet' | 'passwordsDiffer' | 'typeAgain';

/** A new password and its confirmation as a form holds them, under the names of their fields. */
export interface NewPasswordValues {
  password: string;
  'confirm-password': string;
}

const newPasswordFields = { password: z.string(), 'confirm-password': z.string() };

/** The password meets every rule, and the confirmation repeats it. */
const newPasswordCheck = z.superRefine<NewPasswordValues>((values, ctx) => {
  const report = (path: keyof NewPasswordValues, message: NewPasswordProblem) =>
    ctx.addIssue({ code: 'custom', path: [path], message });
  if (unmetPasswordRules(values.password).length > 0) {
    report('password', 'rulesNotMet');
  }
  if (values['confirm-password'] !== values.password) {
    report('confirm-password', values['confirm-password'] ? 'passwordsDiffer' : 'typeAgain');
  }
});

/** What the change-password form checks before it sends. */
export const newPasswordFormSchema = z.object(newPasswordFields).check(newPasswordCheck);

/** What the signup form checks before it sends. The email is the server's to judge. */
export const signupFormSchema = z.object({ email: z.string(), ...newPasswordFields }).check(newPasswordCheck);
