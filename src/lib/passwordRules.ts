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
  // Anything that is not a letter, a number or a space counts.
  { id: 'symbol', label: 'A symbol, such as ! ? @ # $ % & * - _', met: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
  // Unmet until something is typed, so an empty field does not start with a tick.
  { id: 'noSpaces', label: 'No spaces', met: (p) => p.length > 0 && !/\s/u.test(p) },
];

/** The symbols a generated password picks from: `special` in the attribute's syntax, minus the space it includes. */
const GENERATED_SYMBOLS = '[-~!@#$%^&*_+=`|(){}[:;"\'<>,.?]]';

/**
 * The rules in the `passwordrules` attribute's syntax, which Safari and some
 * password managers read to generate a password that passes them.
 */
export const PASSWORD_RULES_ATTRIBUTE = `minlength: ${PASSWORD_MIN_LENGTH}; maxlength: ${PASSWORD_MAX_LENGTH}; required: lower; required: upper; required: digit; required: ${GENERATED_SYMBOLS}; allowed: lower, upper, digit, ${GENERATED_SYMBOLS};`;

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
