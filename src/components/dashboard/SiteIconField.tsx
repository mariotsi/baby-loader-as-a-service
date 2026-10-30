'use client';

import { useLang } from '@/components/LangProvider';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { platformCopy } from '@/lib/copy/platform';
import styles from './SiteEditor.module.css';

interface SiteIconFieldProps {
  isEmoji: boolean;
  onIsEmojiChange: (isEmoji: boolean) => void;
  emoji: string;
  onEmojiChange: (emoji: string) => void;
}

/** The Site icon: the loading baby or an emoji, kept while the loading baby is picked. */
export function SiteIconField({ isEmoji, onIsEmojiChange, emoji, onEmojiChange }: SiteIconFieldProps) {
  const t = platformCopy[useLang()].settings;
  return (
    <div className={styles.icon}>
      <SegmentedControl
        legend={t.siteIcon}
        options={[
          { value: 'loadingBaby', label: t.siteIconLoadingBaby },
          { value: 'emoji', label: t.siteIconEmoji },
        ]}
        value={isEmoji ? 'emoji' : 'loadingBaby'}
        onChange={(value) => onIsEmojiChange(value === 'emoji')}
      />
      {isEmoji ? <EmojiPicker twemoji label={t.siteIconEmojiLabel} value={emoji} onChange={onEmojiChange} /> : null}
    </div>
  );
}
