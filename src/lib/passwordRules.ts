/**
 * What a new password must have. Signup checks it in the browser, ticking
 * each rule off as the Owner types, and the server checks it again. Login
 * never does: a password that was valid when it was set stays valid.
 */

export interface PasswordRule {
  id: string;
  /** Shown in the checklist under the password field. */
  label: string;
  met: (password: string) => boolean;
}

export const PASSWORD_MIN_LENGTH = 10;
/** Bounds the cost of hashing; long enough for any password manager. */
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'length',
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    met: (p) => [...p].length >= PASSWORD_MIN_LENGTH,
  },
  { id: 'lower', label: 'A lowercase letter', met: (p) => /\p{Ll}/u.test(p) },
  { id: 'upper', label: 'An uppercase letter', met: (p) => /\p{Lu}/u.test(p) },
  { id: 'digit', label: 'A number', met: (p) => /\p{Nd}/u.test(p) },
  // Anything that is not a letter, a number or a space counts. A space is allowed, as any other character.
  { id: 'symbol', label: 'A symbol, such as ! ? @ # $ % & * - _', met: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
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
export function newPasswordProblem(password: string): string | null {
  if ([...password].length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  const unmet = unmetPasswordRules(password);
  if (unmet.length > 0) {
    return `Password rules not met yet: ${unmet.map((rule) => rule.label).join(', ')}.`;
  }
  return null;
}
