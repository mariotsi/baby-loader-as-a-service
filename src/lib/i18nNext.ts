import { cookies, headers } from 'next/headers';
import { LANG_COOKIE, LANGS, type Lang, negotiateLang } from './i18n.ts';

/** The request's language among `offered`: the language cookie first, then Accept-Language, then the fallback. */
export async function requestLang(offered: readonly Lang[]): Promise<Lang> {
  if (offered.length === 1) {
    return offered[0];
  }
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()]);
  return negotiateLang(headerList.get('accept-language'), cookieStore.get(LANG_COOKIE)?.value, offered);
}

/** The language a Platform page speaks: negotiated like a Public page's, among every language in `LANGS`. */
export function platformLang(): Promise<Lang> {
  return requestLang(LANGS);
}
