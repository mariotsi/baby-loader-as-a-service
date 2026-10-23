import { OnboardingForm } from '@/components/admin/OnboardingForm';
import { ADDRESS_CONFIG } from '@/lib/address';
import { FONTS, googleFontsHref } from '@/lib/theme';

export default function OnboardingPage() {
  return (
    <>
      {/* The Font picker and the preview write in every Font. */}
      <link rel="stylesheet" href={googleFontsHref(FONTS)} />
      <OnboardingForm addressConfig={ADDRESS_CONFIG} />
    </>
  );
}
