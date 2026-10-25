import * as z from 'zod/mini';
import { type AddressConfig, addressConfig } from './address.ts';
import { type AppEnv, appEnv } from './appEnv.ts';
import { databaseName } from './dbName.ts';

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
  MONGODB_URI: z
    .string()
    .check(z.regex(/^mongodb(\+srv)?:\/\/\S+$/, 'must be a mongodb:// or mongodb+srv:// connection string')),
  MONGODB_DB_NAME: z.optional(z.string()),
  SESSION_SECRET: z.string(),
  VAPID_EMAIL: z.optional(z.string().check(z.regex(/^(mailto:|https:\/\/)\S+$/, 'must be a mailto: or https: URL'))),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.optional(
    z.string().check(z.regex(VAPID_PUBLIC_KEY, 'must be a VAPID public key (npm run generate-vapid)'))
  ),
  VAPID_PRIVATE_KEY: z.optional(
    z.string().check(z.regex(VAPID_PRIVATE_KEY, 'must be a VAPID private key (npm run generate-vapid)'))
  ),
  ROOT_DOMAIN: z.optional(z.string().check(z.regex(HOST, 'must be a host, with a port only for localhost'))),
  VERCEL_ENV: z.optional(
    z.enum(['production', 'preview', 'development'], 'must be production, preview or development')
  ),
  VERCEL_GIT_COMMIT_REF: z.optional(z.string()),
  VERCEL_GIT_COMMIT_SHA: z.optional(z.string()),
  VERCEL_BRANCH_URL: z.optional(z.string()),
});

type Env = z.output<typeof envSchema>;
type RawEnv = Record<string, string | undefined>;

const VAPID_VARS = ['VAPID_EMAIL', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] as const;

/**
 * The rules across variables: the VAPID keypair comes whole or not at all,
 * and databaseName must resolve. They run even when a variable already
 * failed, so one start names every problem.
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
      try {
        databaseName(env);
      } catch (err) {
        // Its message names the variable.
        ctx.addIssue({ code: 'custom', path: [], message: (err as Error).message });
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

/** The MongoDB connection string and this deployment's database (see databaseName). */
export const mongoEnv = lazy(
  { MONGODB_URI: true, MONGODB_DB_NAME: true, VERCEL_ENV: true, VERCEL_GIT_COMMIT_REF: true },
  (env) => ({ uri: env.MONGODB_URI, dbName: databaseName(env) })
);

/** The key that signs session cookies (ADR-0003). */
export const sessionSecret = lazy({ SESSION_SECRET: true }, (env) => env.SESSION_SECRET);

/** The VAPID keypair push Notifications are sent with (ADR-0002), or null when the deployment has none. */
export const vapidEnv = lazy(
  { VAPID_EMAIL: true, NEXT_PUBLIC_VAPID_PUBLIC_KEY: true, VAPID_PRIVATE_KEY: true },
  ({ VAPID_EMAIL: email, NEXT_PUBLIC_VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey }) =>
    email && publicKey && privateKey ? { email, publicKey, privateKey } : null
);

/** Where this deployment serves each Site (see address.ts). */
export const addressEnv = lazy(
  { ROOT_DOMAIN: true, VERCEL_BRANCH_URL: true },
  (env): AddressConfig => addressConfig(env)
);

/** Which deployment this is, and the commit and branch it was built from. */
export const deploymentEnv = lazy(
  { VERCEL_ENV: true, VERCEL_GIT_COMMIT_REF: true, VERCEL_GIT_COMMIT_SHA: true },
  (env): { appEnv: AppEnv; commit: string | null; branch: string | null } => ({
    appEnv: appEnv(env),
    commit: env.VERCEL_GIT_COMMIT_SHA ?? null,
    branch: env.VERCEL_GIT_COMMIT_REF ?? null,
  })
);
