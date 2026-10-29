import { NextResponse } from 'next/server';

/**
 * Why a route refused a request, as a code the page turns into words in its
 * own language (see `routeErrorText`). Site settings errors travel apart, as
 * `{ errors: SiteSettingsError[] }`.
 */
export type RouteErrorCode =
  | 'rateLimited'
  | 'invalidEmail'
  | 'passwordTooLong'
  | 'passwordRules'
  | 'emailTaken'
  | 'wrongCredentials'
  | 'passwordResetRequired'
  | 'passwordChangePending'
  | 'notAuthenticated'
  | 'notFound'
  | 'pushNotConfigured'
  | 'invalidRequest'
  | 'unsupportedMediaType'
  | 'mediaTooLarge'
  | 'mediaCachePurgeFailed'
  | 'mediaStorageUnavailable'
  | 'unknownSite';

export interface RouteError {
  code: RouteErrorCode;
  params?: { max?: number };
}

/** A JSON response of `{ error: { code, params } }`, with no prose in it. */
export function routeError(status: number, error: RouteError): NextResponse {
  return NextResponse.json({ error }, { status });
}
