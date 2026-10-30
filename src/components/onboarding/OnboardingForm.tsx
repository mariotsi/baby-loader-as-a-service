'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, type SubmitEvent, useId, useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { PagePreview } from '@/components/PagePreview';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { FontPicker } from '@/components/ui/FontPicker';
import { Input } from '@/components/ui/Input';
import { LanguagesPicker } from '@/components/ui/LanguagesPicker';
import { PageShell } from '@/components/ui/PageShell';
import { PalettePicker } from '@/components/ui/PalettePicker';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { Switch } from '@/components/ui/Switch';
import { type AddressConfig, siteAddress, slugProblem } from '@/lib/address';
import { errorsCopy } from '@/lib/copy/errors';
import { type PlatformCopy, platformCopy } from '@/lib/copy/platform';
import { responseErrorText } from '@/lib/errorText';
import { fallbackLang, type Lang } from '@/lib/i18n';
import { publicPageView } from '@/lib/publicPageView';
import { defaultSiteSettings, type SiteSettings } from '@/lib/siteSettings';
import { DEFAULT_FONT, DEFAULT_PALETTE } from '@/lib/theme';
import styles from './OnboardingForm.module.css';

/** Why the Slug cannot be an Address, if it cannot. */
function slugError(slug: string, t: PlatformCopy['onboarding']): string | undefined {
  const problem = slug ? slugProblem(slug) : null;
  if (problem === 'invalidFormat') {
    return t.slugFormat;
  }
  if (problem === 'slugReserved') {
    return t.slugReserved;
  }
  return undefined;
}

/** A card title with its step number, so the form reads as three short steps. */
function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <>
      <span className={styles.step} aria-hidden="true">
        {n}
      </span>
      {children}
    </>
  );
}

/** `addressConfig` comes from the server page: only the server knows the root domain. */
export function OnboardingForm({ addressConfig }: { addressConfig: AddressConfig }) {
  const router = useRouter();
  const lang = useLang();
  const { onboarding: t, privacy } = platformCopy[lang];
  const previewId = useId();
  const [slug, setSlug] = useState('');
  const [babyName, setBabyName] = useState('');
  const [dueDate, setDueDate] = useState('');
  // A new Site starts in the language its Owner reads the Platform in.
  const [languages, setLanguages] = useState<Lang[]>([lang]);
  const [palette, setPalette] = useState(DEFAULT_PALETTE);
  const [font, setFont] = useState(DEFAULT_FONT);
  const [showName, setShowName] = useState(true);
  const [showSex, setShowSex] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const settings = {
    ...defaultSiteSettings,
    babyName,
    dueDate: dueDate || null,
    languages,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    theme: { palette, font },
    privacy: { showName, showSex },
  };
  const preview = publicPageView(settings as SiteSettings, fallbackLang(languages));
  const trimmedSlug = slug.trim();
  const slugProblemText = slugError(trimmedSlug, t);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, settings }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(responseErrorText(data, lang));
        return;
      }
      router.push(`/dashboard/${data.site.slug}`);
    } catch {
      setError(errorsCopy[lang].generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell width="wide">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1 className={styles.title}>{t.title}</h1>
        <p className={styles.lead}>{t.lead}</p>
      </div>
      <form onSubmit={onSubmit} className={styles.layout}>
        <div className={styles.cards}>
          <Card title={<Step n={1}>{t.basics}</Step>} description={t.basicsDescription}>
            <Field
              label={t.siteAddress}
              hint={slugProblemText ? undefined : t.pageWillBeAt(siteAddress(trimmedSlug || 'emma', addressConfig))}
              error={slugProblemText}
              liveHint
              required
            >
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="emma"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </Field>
            <Field label={t.babyName} required>
              <Input value={babyName} onChange={(e) => setBabyName(e.target.value)} autoComplete="off" />
            </Field>
            <Field label={t.dueDate} optional hint={t.dueDateHint}>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </Card>
          <Card title={<Step n={2}>{t.makeItYours}</Step>} description={t.makeItYoursDescription}>
            <PalettePicker value={palette} onChange={setPalette} />
            <FontPicker value={font} onChange={setFont} sample={babyName.trim() || 'Aa'} />
            <LanguagesPicker value={languages} onChange={setLanguages} />
          </Card>
          <Card title={<Step n={3}>{t.whoSeesWhat}</Step>} description={t.whoSeesWhatDescription}>
            <div>
              <Switch label={privacy.showName} checked={showName} onChange={(e) => setShowName(e.target.checked)} />
              <Switch label={privacy.showSex} checked={showSex} onChange={(e) => setShowSex(e.target.checked)} />
            </div>
          </Card>
        </div>
        <section className={styles.preview} aria-labelledby={previewId}>
          <h2 id={previewId} className={styles.previewTitle}>
            {t.yourPage}
          </h2>
          <PagePreview view={preview} theme={settings.theme} />
        </section>
        <div className={styles.actions}>
          <StatusMessage tone="danger">{error}</StatusMessage>
          <Button variant="primary" type="submit" icon="plus" loading={loading}>
            {loading ? t.creating : t.create}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
