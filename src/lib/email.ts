import * as z from 'zod/mini';

/**
 * A User's email address, as accounts store and look it up: trimmed,
 * lowercased, and shaped like `name@host.tld`. Whether it reaches anyone is
 * not checked. Pure, so a form can run the same rule.
 */
export const emailSchema = z
  .string()
  .check(z.trim(), z.toLowerCase(), z.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
  .brand<'Email'>();
export type Email = z.output<typeof emailSchema>;
export function isEmail(value: unknown): value is Email {
  return emailSchema.safeParse(value).success;
}
