import { isHTTPError } from 'ky';

/**
 * Why a call to another service failed, safe for a log: the status it
 * answered, or else the kind of error, such as `TimeoutError`.
 *
 * Never log or wrap such an error itself. ky's hold the request with its
 * headers and name its URL in their message, so they carry a token, a
 * Visitor's IP or a Site's words into Workers Logs, and a JSON parse error
 * quotes the body it was given.
 */
export function outboundFailure(error: unknown): string {
  if (isHTTPError(error)) {
    return `status ${error.response.status}`;
  }
  return error instanceof Error ? error.name : 'an unknown error';
}
