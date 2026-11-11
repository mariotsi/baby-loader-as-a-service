import { SiteCreator } from '@/components/onboarding/SiteCreator';
import { addressEnv, deploymentEnv } from '@/lib/env';
import { FONTS, googleFontsHref } from '@/lib/theme';
import { bornPlaceholderUrl } from '@/lib/websiteAssets';

export default function OnboardingPage() {
  return (
    <>
      {/* The Font picker and the preview write in every Font. */}
      <link rel="stylesheet" href={googleFontsHref(FONTS)} />
      <SiteCreator addressConfig={addressEnv()} bornPlaceholderUrl={bornPlaceholderUrl(deploymentEnv().appEnv)} />
    </>
  );
}
