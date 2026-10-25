# Copy lives in typed TypeScript dictionaries, with no i18n library

Every page's words, Public and Platform alike, live in TypeScript objects under `src/lib/copy/`, one file per area, with one object per language in `Lang`. English sets the shape (`type PlatformCopy = typeof en`) and every other language is typed against it, so a missing or misnamed entry fails `npm run typecheck`. Entries that take values are functions, plurals go through `plural` (`Intl.PluralRules`), and dates and numbers through `Intl` or date-fns with the language. The language is negotiated by `negotiateLang` in `src/lib/i18n.ts`, among a Site's Languages on a Public page and among every language in `LANGS` on a Platform page; Client Components read it with `useLang()`.

A library such as next-intl adds ICU message strings, translator-friendly JSON and per-language bundles. With two languages and no translators outside the repo, it costs more than it gives: its URL routing clashes with Addresses resolved in `src/proxy.ts`, its mode without routing still needs our negotiation, a key missing from one language's JSON surfaces only at runtime, and the Public page would either keep its own system or be rewritten onto it.

## Consequences

- Adding a language to `Lang` makes every dictionary a type error until it has that language's object; no component changes.
- Every language ships to the browser for Client Components that import a dictionary. Worth revisiting past a handful of languages, or once translators outside the repo need a file format they can edit.
