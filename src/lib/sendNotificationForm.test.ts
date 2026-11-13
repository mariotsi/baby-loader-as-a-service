import { expect, test } from 'vitest';
import { messagesOf, sendNotificationFormSchema } from './sendNotificationForm.ts';

/** The fields in error, with each problem's code. */
function problems(bodies: Record<string, string>) {
  const result = sendNotificationFormSchema(['it', 'en']).safeParse({ titles: {}, bodies });
  return result.success ? [] : result.error.issues.map((issue) => [issue.path.join('.'), issue.message]);
}

test("a Notification needs a message in each of the Site's Languages", () => {
  expect(problems({ it: 'Ci siamo', en: 'Here we go' })).toStrictEqual([]);
  expect(problems({ it: 'Ci siamo', en: '   ' })).toStrictEqual([['bodies.en', 'missingBody']]);
  expect(problems({})).toStrictEqual([
    ['bodies.it', 'missingBody'],
    ['bodies.en', 'missingBody'],
  ]);
});

test('a message in a Language the Site does not speak is neither asked for nor sent', () => {
  const values = {
    titles: { it: ' Novità ', en: ' ' },
    bodies: { it: ' Ci siamo ', en: 'Here we go', fr: 'On y est' },
  };
  expect(sendNotificationFormSchema(['it', 'en']).safeParse(values).success).toBe(true);
  expect(messagesOf(values, ['it', 'en'])).toStrictEqual({
    it: { title: 'Novità', body: 'Ci siamo' },
    en: { body: 'Here we go' },
  });
});
