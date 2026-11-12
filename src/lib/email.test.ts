import { expect, test } from 'vitest';
import { emailSchema, isEmail } from './email.ts';

test('an email address is stored trimmed and lowercased', () => {
  expect(emailSchema.parse('  Ada@Example.COM ')).toBe('ada@example.com');
  expect(isEmail('ada@example.com')).toBe(true);
});

test('anything not shaped like name@host.tld is no email address', () => {
  for (const value of [
    undefined,
    42,
    '',
    'ada',
    'ada@example',
    '@example.com',
    'a da@example.com',
    'ada@@example.com',
  ]) {
    expect(isEmail(value), String(value)).toBe(false);
  }
});
