import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CredentialsForm } from '@/components/admin/CredentialsForm';
import { OnboardingForm } from '@/components/admin/OnboardingForm';
import { addressConfig } from '@/lib/address';
import { PublicPageDemo } from './PublicPageDemo';

const meta = {
  title: 'Demos',
  parameters: { page: true },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The real Public page in the Waiting state, in the Palette and Font of the toolbar (it starts in the Platform
 * theme). Try every viewport.
 */
export const PublicPageWaiting: Story = {
  name: 'Public page, waiting',
  render: () => <PublicPageDemo state="waiting" />,
};

/** The same page in the Born state. */
export const PublicPageBorn: Story = {
  name: 'Public page, born',
  render: () => <PublicPageDemo state="born" />,
};

/** The real onboarding form, with the live preview of the page it creates. */
export const Onboarding: Story = {
  render: () => <OnboardingForm addressConfig={addressConfig({ ROOT_DOMAIN: 'loading.baby' })} />,
};

/** The real login page. */
export const Login: Story = {
  render: () => <CredentialsForm mode="login" />,
};

/** The real signup page: the password's rules tick off as you type, and Sign up checks them and the confirmation. */
export const Signup: Story = {
  render: () => <CredentialsForm mode="signup" />,
};
