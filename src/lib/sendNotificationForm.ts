import * as z from 'zod/mini';
import type { Lang } from './i18n.ts';

/** A text per Language, as the send-notification form holds them while the Owner types. */
type Texts = Partial<Record<Lang, string>>;

/** What the send-notification form holds: a title and a message in each of the Site's Languages. */
export interface SendNotificationValues {
  titles: Texts;
  bodies: Texts;
}

const texts = z.record(z.string(), z.optional(z.string()));

/**
 * What the send-notification form checks before it sends: a message in each
 * of the Site's `languages`. A missing one is reported at `bodies.<language>`
 * with the message `missingBody`, the key of its words in the Platform's
 * dictionary (`send`). The server judges the rest.
 */
export function sendNotificationFormSchema(languages: readonly Lang[]) {
  return z.object({ titles: texts, bodies: texts }).check(
    z.superRefine((values, ctx) => {
      for (const lang of languages) {
        if (!values.bodies[lang]?.trim()) {
          ctx.addIssue({ code: 'custom', path: ['bodies', lang], message: 'missingBody' });
        }
      }
    })
  );
}

/** The Notification's texts as the route takes them: trimmed, and a title only where one is written. */
export function messagesOf({ titles, bodies }: SendNotificationValues, languages: readonly Lang[]) {
  return Object.fromEntries(
    languages.map((lang) => {
      const title = titles[lang]?.trim();
      const body = bodies[lang]?.trim() ?? '';
      return [lang, title ? { title, body } : { body }];
    })
  );
}
