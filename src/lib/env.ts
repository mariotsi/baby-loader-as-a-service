import * as z from 'zod/mini';
import { type AddressConfig, addressConfig } from './address.ts';
import { type AppEnv, appEnv } from './appEnv.ts';

/**
 * Every environment variable the server reads, and the only place that reads
 * them (NODE_ENV and NEXT_RUNTIME aside, which Next.js sets itself). The
 * server checks all of them once when it starts (src/instrumentation.ts);
 * modules read the typed values below, each parsed on first use and never at
 * import time: `next build` collects route data without these variables.
 *
 * An empty variable counts as unset, as `.env.local.example` leaves some.
 */

/** URL-safe base64 without padding, as web-push requires: 65 bytes starting with 0x04 for the public key, 32 for the private one. */
const VAPID_PUBLIC_KEY = /^B[A-Za-z0-9_-]{86}$/;
const VAPID_PRIVATE_KEY = /^[A-Za-z0-9_-]{43}$/;
/** A host with an optional port, without protocol or path (`loading.baby`, `localhost:3000`). */
const HOST = /^[a-z0-9.-]+(:\d+)?$/i;

const envSchema = z.object({
  SESSION_SECRET: z.string(),
  VAPID_EMAIL: z.optional(z.string().check(z.regex(/^(mailto:|https:\/\/)\S+$/, 'must be a mailto: or https: URL'))),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.optional(
    z.string().check(z.regex(VAPID_PUBLIC_KEY, 'must be a VAPID public key (npm run generate-vapid)'))
  ),
  VAPID_PRIVATE_KEY: z.optional(
    z.string().check(z.regex(VAPID_PRIVATE_KEY, 'must be a VAPID private key (npm run generate-vapid)'))
  ),
  ROOT_DOMAIN: z.optional(z.string().check(z.regex(HOST, 'must be a host, with a port only for localhost'))),
  MEDIA_STORAGE_ENDPOINT: z.string().check(z.regex(/^https:\/\//, 'must be an HTTPS URL')),
  MEDIA_STORAGE_BUCKET: z.string(),
  MEDIA_STORAGE_ACCESS_KEY_ID: z.string(),
  MEDIA_STORAGE_SECRET_ACCESS_KEY: z.string(),
  MEDIA_PUBLIC_URL: z.string().check(z.regex(/^https:\/\//, 'must be an HTTPS URL')),
  MEDIA_CACHE_PURGE_TOKEN: z.string(),
  MEDIA_CACHE_PURGE_ZONE_ID: z.string().check(z.regex(/^[0-9a-f]{32}$/i, 'must be a Cloudflare zone ID')),
  APP_ENV: z.optional(
    z.enum(['production', 'staging', 'preview', 'development'], 'must be production, staging, preview or development')
  ),
  GIT_COMMIT_SHA: z.optional(z.string()),
  GIT_BRANCH: z.optional(z.string()),
});

type Env = z.output<typeof envSchema>;
type RawEnv = Record<string, string | undefined>;

const VAPID_VARS = ['VAPID_EMAIL', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] as const;
/**
 * The rule across variables: the VAPID keypair comes whole or not at all. It
 * runs even when a variable already failed, so one start names every problem.
 */
const fullSchema = envSchema.check(
  z.superRefine(
    (env, ctx) => {
      const missing = VAPID_VARS.filter((name) => !env[name]);
      if (missing.length > 0 && missing.length < VAPID_VARS.length) {
        for (const name of missing) {
          ctx.addIssue({ code: 'custom', path: [name], message: 'is not set, while the rest of the VAPID keypair is' });
        }
      }
    },
    { when: () => true }
  )
);

export class EnvError extends Error {}

function withoutEmpty(env: RawEnv): RawEnv {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
}

function parse<T>(schema: z.ZodMiniType<T>, env: RawEnv): T {
  const result = schema.safeParse(withoutEmpty(env));
  if (result.success) {
    return result.data;
  }
  const problems = result.error.issues.map((issue) => {
    // Every variable is a string, so a wrong type can only be a missing one.
    const message = issue.code === 'invalid_type' ? 'is not set' : issue.message;
    return `- ${[...issue.path, message].join(' ')}`;
  });
  throw new EnvError(`Invalid environment variables:\n${problems.join('\n')}`);
}

/**
 * Checks every variable and throws one error naming each missing or
 * malformed one. Called once at server start.
 */
export function validateEnv(env: RawEnv): Env {
  return parse(fullSchema, env);
}

/** The variables `mask` names, parsed from process.env on the first call. */
function lazy<K extends keyof Env, T>(mask: Record<K, true>, read: (env: Pick<Env, K>) => T): () => T {
  const schema = z.pick(envSchema, mask as never) as unknown as z.ZodMiniType<Pick<Env, K>>;
  let value: { current: T } | undefined;
  return () => {
    value ??= { current: read(parse(schema, process.env)) };
    return value.current;
  };
}

/** The key that signs session cookies (ADR-0003). */
export const sessionSecret = lazy({ SESSION_SECRET: true }, (env) => env.SESSION_SECRET);

/** The VAPID keypair push Notifications are sent with (ADR-0002), or null when the deployment has none. */
export const vapidEnv = lazy(
  { VAPID_EMAIL: true, NEXT_PUBLIC_VAPID_PUBLIC_KEY: true, VAPID_PRIVATE_KEY: true },
  ({ VAPID_EMAIL: email, NEXT_PUBLIC_VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey }) =>
    email && publicKey && privateKey ? { email, publicKey, privateKey } : null
);

/** Where this deployment serves each Site (see address.ts). */
export const addressEnv = lazy({ ROOT_DOMAIN: true }, (env): AddressConfig => addressConfig(env));

/** Which deployment this is, and the commit and branch it was built from, as the deploy sets them. */
export const deploymentEnv = lazy(
  { APP_ENV: true, GIT_COMMIT_SHA: true, GIT_BRANCH: true },
  (env): { appEnv: AppEnv; commit: string | null; branch: string | null } => ({
    appEnv: appEnv(env),
    commit: env.GIT_COMMIT_SHA ?? null,
    branch: env.GIT_BRANCH ?? null,
  })
);

/** Required S3-compatible media storage configuration. */
export const mediaStorageEnv = lazy(
  {
    MEDIA_STORAGE_ENDPOINT: true,
    MEDIA_STORAGE_BUCKET: true,
    MEDIA_STORAGE_ACCESS_KEY_ID: true,
    MEDIA_STORAGE_SECRET_ACCESS_KEY: true,
    MEDIA_PUBLIC_URL: true,
    MEDIA_CACHE_PURGE_TOKEN: true,
    MEDIA_CACHE_PURGE_ZONE_ID: true,
  },
  (env) => {
    return {
      endpoint: env.MEDIA_STORAGE_ENDPOINT,
      bucket: env.MEDIA_STORAGE_BUCKET,
      accessKeyId: env.MEDIA_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.MEDIA_STORAGE_SECRET_ACCESS_KEY,
      publicUrl: env.MEDIA_PUBLIC_URL.replace(/\/$/, ''),
      cachePurgeToken: env.MEDIA_CACHE_PURGE_TOKEN,
      cachePurgeZoneId: env.MEDIA_CACHE_PURGE_ZONE_ID,
    };
  }
);
