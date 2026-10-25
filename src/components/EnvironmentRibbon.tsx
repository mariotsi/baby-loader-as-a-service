import type { AppEnv } from '@/lib/appEnv';
import { deploymentEnv } from '@/lib/env';

const LABELS: Partial<Record<AppEnv, string>> = {
  staging: 'Staging',
  preview: 'Preview',
  development: 'Development',
};

/**
 * Corner ribbon naming the environment on every page: staging (blue),
 * preview (yellow) and local development (green); production renders
 * nothing. It ignores pointer events, so it never covers a control.
 */
export function EnvironmentRibbon() {
  const env = deploymentEnv().appEnv;
  const label = LABELS[env];
  if (!label) {
    return null;
  }
  return (
    <div className={`env-ribbon env-ribbon-${env}`} role="status">
      {label}
    </div>
  );
}
