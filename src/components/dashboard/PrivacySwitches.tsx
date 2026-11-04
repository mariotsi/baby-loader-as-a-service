'use client';

import { useLang } from '@/components/LangProvider';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { Switch } from '@/components/ui/Switch';
import { platformCopy } from '@/lib/copy/platform';
import type { SiteSettings } from '@/lib/siteSettings';

interface PrivacySwitchesProps {
  /** Once Born the page shows the name and the Sex whatever these say, so both switches rest until the Countdown is back. */
  born?: boolean;
  babyName: string;
  sex: SiteSettings['sex'];
  showName: boolean;
  showSex: boolean;
  onShowName: (showName: boolean) => void;
  onShowSex: (showSex: boolean) => void;
}

/**
 * The Privacy settings. With no name or no known Sex there is nothing to show,
 * so that switch stays off and locked, and `showName` and `showSex` keep the
 * Owner's choice for when it is back: what was hidden never comes back shown.
 * While `born`, both stay locked on the Owner's choice, under a note saying why.
 */
export function PrivacySwitches({
  born = false,
  babyName,
  sex,
  showName,
  showSex,
  onShowName,
  onShowSex,
}: PrivacySwitchesProps) {
  const { privacy } = platformCopy[useLang()];
  const named = babyName.trim() !== '';
  const sexKnown = sex !== 'unknown';
  return (
    <div>
      <StatusMessage tone="info">{born ? privacy.bornNote : null}</StatusMessage>
      <Switch
        label={privacy.showName}
        hint={named || born ? undefined : privacy.noNameYet}
        checked={showName && named}
        disabled={!named || born}
        onChange={(e) => onShowName(e.target.checked)}
      />
      <Switch
        label={privacy.showSex}
        hint={sexKnown || born ? undefined : privacy.noSexYet}
        checked={showSex && sexKnown}
        disabled={!sexKnown || born}
        onChange={(e) => onShowSex(e.target.checked)}
      />
    </div>
  );
}
