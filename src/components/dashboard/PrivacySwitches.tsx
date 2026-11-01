'use client';

import { useLang } from '@/components/LangProvider';
import { Switch } from '@/components/ui/Switch';
import { platformCopy } from '@/lib/copy/platform';

interface PrivacySwitchesProps {
  babyName: string;
  showName: boolean;
  showSex: boolean;
  onShowName: (showName: boolean) => void;
  onShowSex: (showSex: boolean) => void;
}

/**
 * The Privacy settings. With no name there is nothing to hide, so the name's
 * switch shows on and locked, and `showName` keeps the Owner's choice for when
 * a name is back: a name hidden once never comes back shown on its own.
 */
export function PrivacySwitches({ babyName, showName, showSex, onShowName, onShowSex }: PrivacySwitchesProps) {
  const { privacy } = platformCopy[useLang()];
  const named = babyName.trim() !== '';
  return (
    <div>
      <Switch
        label={privacy.showName}
        hint={named ? undefined : privacy.noNameYet}
        checked={showName || !named}
        disabled={!named}
        onChange={(e) => onShowName(e.target.checked)}
      />
      <Switch label={privacy.showSex} checked={showSex} onChange={(e) => onShowSex(e.target.checked)} />
    </div>
  );
}
