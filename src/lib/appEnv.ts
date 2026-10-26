/** Which deployment of the Platform this is (see "Environments" in the README). */
export type AppEnv = 'production' | 'staging' | 'preview' | 'development';

const DEPLOYED: readonly AppEnv[] = ['production', 'staging', 'preview'];

/**
 * APP_ENV, which each Worker's wrangler config sets: "production" on
 * loading-baby, "staging" on loading-baby-staging and "preview" on its
 * Previews. Anything else, unset included, is "development".
 */
export function appEnv(env: Record<string, string | undefined>): AppEnv {
  const value = env.APP_ENV as AppEnv | undefined;
  return value && DEPLOYED.includes(value) ? value : 'development';
}
