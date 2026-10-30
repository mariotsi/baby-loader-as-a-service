import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import type { Lang } from '@/lib/i18n';
import { publicPageView } from '@/lib/publicPageView';
import { defaultSiteSettings } from '@/lib/siteSettings';
import { Confetti } from './Confetti';
import { LanguageSwitcher } from './LanguageSwitcher';
import { PushSubscribeView } from './PushSubscribeButton';
import { Stack } from './ui/Stack';

const desktop = { ios: false, android: false, chrome: true, standalone: false, iosVersion: null };
const iphone = { ...desktop, ios: true, chrome: false, iosVersion: '18.0' };
const android = { ...desktop, android: true };
const copy = (lang: 'en' | 'it', born = false) =>
  publicPageView(
    {
      ...defaultSiteSettings,
      babyName: 'Emma',
      sex: 'female',
      ...(born
        ? {
            birth: {
              born: true,
              details: { datetime: '2026-10-26T12:00:00Z', weightGrams: null, lengthCm: null, message: {} },
            },
          }
        : {}),
    },
    lang
  ).push;

const meta = {
  title: 'Pages/Notifications',
  component: PushSubscribeView,
  tags: ['autodocs'],
  args: {
    status: 'unsubscribed',
    device: desktop,
    t: copy('en'),
    onSubscribe: () => {},
    onUnsubscribe: () => {},
    onConfirmOpenChange: () => {},
  },
  render: function Interactive(args, { parameters }) {
    const [lang, setLang] = useState<Lang>(parameters.language ?? 'en');
    const translated = { ...copy(lang, parameters.born ?? false), appName: args.t.appName, appIcon: args.t.appIcon };
    const [status, setStatus] = useState(args.status);
    const [open, setOpen] = useState(args.confirmOpen ?? false);
    const [confettiShots, setConfettiShots] = useState(0);
    return (
      <Stack gap={4} align="stretch">
        <Stack direction="row" justify="end">
          <LanguageSwitcher
            langs={['en', 'it']}
            current={lang}
            label={lang === 'it' ? 'Lingua' : 'Language'}
            onChange={setLang}
          />
        </Stack>
        <PushSubscribeView
          {...args}
          t={translated}
          status={status}
          confirmOpen={open}
          onSubscribe={() => {
            setStatus('subscribed');
            if (!parameters.reducedMotion) {
              setConfettiShots((shots) => shots + 1);
            }
          }}
          onUnsubscribe={() => {
            setStatus('unsubscribed');
            setOpen(false);
          }}
          onConfirmOpenChange={setOpen}
        />
        <Confetti shots={confettiShots} />
      </Stack>
    );
  },
} satisfies Meta<typeof PushSubscribeView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Simulates opting in and celebrates without requesting browser permission or saving a subscription. */
export const Subscribe: Story = {};
/** Offers updates after the birth. */
export const Born: Story = { parameters: { born: true } };
/** Shows the confirmed subscription with its deactivation link. */
export const Subscribed: Story = { args: { status: 'subscribed' } };
/** Opens the deactivation confirmation from the link. */
export const Confirmation: Story = { args: { status: 'subscribed', confirmOpen: true } };
/** Shows the initial capability check. */
export const Checking: Story = { args: { status: 'checking' } };
/** Shows an in-flight subscription. */
export const Subscribing: Story = { args: { busy: true } };
/** Shows a failed subscription with a retry action. */
export const SubscriptionError: Story = { args: { feedback: 'errorGeneric' } };
/** Shows a failed deactivation while notifications remain active. */
export const DeactivationError: Story = { args: { status: 'subscribed', feedback: 'errorUnsubscribe' } };
/** Confirms deactivation and offers opting in again. */
export const Deactivated: Story = { args: { feedback: 'unsubscribeOk' } };
/** Explains unsupported browser capabilities. */
export const Unsupported: Story = { args: { status: 'unsupported' } };
/** Explains permissions blocked in desktop browser settings. */
export const DesktopBlocked: Story = { args: { status: 'denied' } };
/** Guides iPhone visitors through adding the Site to the Home Screen. */
export const IPhoneHomeScreen: Story = { args: { status: 'ios-home-screen', device: iphone } };
/** Explains the minimum iOS version for web push. */
export const IPhoneOlderIOS: Story = { args: { status: 'unsupported', device: { ...iphone, iosVersion: '16.3' } } };
/** Links to iPhone notification settings help. */
export const IPhoneBlocked: Story = { args: { status: 'denied', device: { ...iphone, standalone: true } } };
/** Links to Chrome's Android notification settings help. */
export const AndroidChromeBlocked: Story = { args: { status: 'denied', device: android } };
/** Unsupported Android browsers receive browser guidance. */
export const AndroidUnsupported: Story = { args: { status: 'unsupported', device: { ...android, chrome: false } } };
/** Opting in skips confetti when reduced motion is enabled. */
export const ReducedMotion: Story = { parameters: { reducedMotion: true } };

/** Uses the classic Safari Share menu on iOS 16.4. */
export const IPhoneIOS164: Story = { args: { status: 'ios-home-screen', device: { ...iphone, iosVersion: '16.4' } } };
/** Uses the classic Safari Share menu on iOS 17. */
export const IPhoneIOS17: Story = { args: { status: 'ios-home-screen', device: { ...iphone, iosVersion: '17.0' } } };
/** Uses the classic Safari Share menu on iOS 18. */
export const IPhoneIOS18: Story = { args: { status: 'ios-home-screen', device: iphone } };
/** Includes the iOS 26 layout choices and Open as Web App switch. */
export const IPhoneIOS26: Story = { args: { status: 'ios-home-screen', device: { ...iphone, iosVersion: '26.0' } } };
/** Uses generic guidance when the OS version is uncertain or frozen. */
export const IPhoneUnknownVersion: Story = {
  args: { status: 'ios-home-screen', device: { ...iphone, iosVersion: null } },
};
/** Shows the verified iOS 27 Page Menu instructions. */
export const IPhoneIOS27: Story = {
  args: { status: 'ios-home-screen', device: { ...iphone, iosVersion: '27.0' } },
};

/** Falls back to generic instructions for an unverified version. */
export const IPhoneFutureVersion: Story = {
  args: { status: 'ios-home-screen', device: { ...iphone, iosVersion: '28.0' } },
};

/** Shows an emoji app icon, with the brand icon as its image failure fallback. */
export const IPhoneEmojiApp: Story = {
  args: {
    status: 'ios-home-screen',
    device: { ...iphone, iosVersion: '27.0' },
    t: publicPageView({ ...defaultSiteSettings, babyName: 'Emma', icon: '🐣' }, 'en').push,
  },
};
/** Keeps the app preview visible when an image cannot load. */
export const IPhoneMissingAppIcon: Story = {
  args: {
    status: 'ios-home-screen',
    device: { ...iphone, iosVersion: '27.0' },
    t: { ...copy('en'), appIcon: '/missing-app-icon.png' },
  },
};
