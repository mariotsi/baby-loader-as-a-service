import { OnboardingForm } from '@/components/admin/OnboardingForm';
import { ADDRESS_CONFIG } from '@/lib/address';

export default function OnboardingPage() {
  return <OnboardingForm addressConfig={ADDRESS_CONFIG} />;
}
