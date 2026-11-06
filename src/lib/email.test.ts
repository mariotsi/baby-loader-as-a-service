import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emailSchema, isEmail } from './email.ts';

test('an email address is stored trimmed and lowercased', () => {
  assert.equal(emailSchema.parse('  Ada@Example.COM '), 'ada@example.com');
  assert.equal(isEmail('ada@example.com'), true);
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
    assert.equal(isEmail(value), false, String(value));
  }
});
