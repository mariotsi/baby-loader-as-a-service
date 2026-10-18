/** Which deployment of the Platform this is (see "Environments" in the README). */
export type AppEnv = 'production' | 'staging' | 'preview' | 'development';

/**
 * Derived from the system variables Vercel sets on every deployment, so no
 * environment needs extra configuration: a Vercel preview deployment is
 * "preview", a production deployment of the `staging` branch is "staging",
 * any other production deployment is "production", and anything off Vercel
 * is "development".
 */
export function appEnv(env: Record<string, string | undefined>): AppEnv {
  if (env.VERCEL_ENV === 'preview') {
    return 'preview';
  }
  if (env.VERCEL_ENV === 'production') {
    return env.VERCEL_GIT_COMMIT_REF === 'staging' ? 'staging' : 'production';
  }
  return 'development';
}
