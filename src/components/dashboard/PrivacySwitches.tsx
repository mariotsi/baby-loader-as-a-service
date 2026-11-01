'use client';

import { useLang } from '@/components/LangProvider';
import { Switch } from '@/components/ui/Switch';
import { platformCopy } from '@/lib/copy/platform';
import type { SiteSettings } from '@/lib/siteSettings';

interface PrivacySwitchesProps {
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
 */
export function PrivacySwitches({ babyName, sex, showName, showSex, onShowName, onShowSex }: PrivacySwitchesProps) {
  const { privacy } = platformCopy[useLang()];
  const named = babyName.trim() !== '';
  const sexKnown = sex !== 'unknown';
  return (
    <div>
      <Switch
        label={privacy.showName}
        hint={named ? undefined : privacy.noNameYet}
        checked={showName && named}
        disabled={!named}
        onChange={(e) => onShowName(e.target.checked)}
      />
      <Switch
        label={privacy.showSex}
        hint={sexKnown ? undefined : privacy.noSexYet}
        checked={showSex && sexKnown}
        disabled={!sexKnown}
        onChange={(e) => onShowSex(e.target.checked)}
      />
    </div>
  );
}
