import { OnboardingForm } from '@/components/onboarding/OnboardingForm';
import { addressEnv } from '@/lib/env';
import { FONTS, googleFontsHref } from '@/lib/theme';

export default function OnboardingPage() {
  return (
    <>
      {/* The Font picker and the preview write in every Font. */}
      <link rel="stylesheet" href={googleFontsHref(FONTS)} />
      <OnboardingForm addressConfig={addressEnv()} />
    </>
  );
}
