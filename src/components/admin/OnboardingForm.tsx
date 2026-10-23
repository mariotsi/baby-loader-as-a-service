'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, type SubmitEvent, useId, useState } from 'react';
import { describeSiteSettingsErrors } from '@/components/admin/siteSettingsErrorText';
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
import type { Lang } from '@/lib/i18n';
import { publicPageView } from '@/lib/publicPageView';
import { defaultSiteSettings, type SiteSettings } from '@/lib/siteSettings';
import { DEFAULT_FONT, DEFAULT_PALETTE } from '@/lib/theme';
import styles from './OnboardingForm.module.css';

/** Why the Slug cannot be an Address, if it cannot. */
function slugError(slug: string): string | undefined {
  const problem = slug ? slugProblem(slug) : null;
  if (problem === 'invalidFormat') {
    return 'Use 3-32 lowercase letters, numbers or hyphens, with no hyphen at either end.';
  }
  if (problem === 'slugReserved') {
    return 'This address is reserved.';
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
  const previewId = useId();
  const [slug, setSlug] = useState('');
  const [babyName, setBabyName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [languages, setLanguages] = useState<Lang[]>(['en']);
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
  const preview = publicPageView(settings as SiteSettings, languages[0]);
  const trimmedSlug = slug.trim();
  const slugProblemText = slugError(trimmedSlug);

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
        setError(data.errors ? describeSiteSettingsErrors(data.errors) : data.error || 'Something went wrong.');
        return;
      }
      router.push(`/admin/${data.site.slug}`);
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell width="wide">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Your new page</p>
        <h1 className={styles.title}>Create your waiting page</h1>
        <p className={styles.lead}>Three little steps, and everyone can start counting the days with you.</p>
      </div>
      <form onSubmit={onSubmit} className={styles.layout}>
        <div className={styles.cards}>
          <Card title={<Step n={1}>The basics</Step>} description="Where your page lives and who it is for.">
            <Field
              label="Site address"
              hint={
                slugProblemText
                  ? undefined
                  : `Your page will be at ${siteAddress(trimmedSlug || 'emma', addressConfig)}`
              }
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
            <Field label="Baby's name" required>
              <Input value={babyName} onChange={(e) => setBabyName(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Due date" optional hint="Your page counts the days down to it.">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </Card>
          <Card title={<Step n={2}>Make it yours</Step>} description="Pick the colors and letters your page wears.">
            <PalettePicker value={palette} onChange={setPalette} />
            <FontPicker value={font} onChange={setFont} sample={babyName.trim() || 'Aa'} />
            <LanguagesPicker value={languages} onChange={setLanguages} />
          </Card>
          <Card title={<Step n={3}>Who sees what</Step>} description="Until the birth, you decide what the page tells.">
            <div>
              <Switch
                label="Show the name while waiting"
                checked={showName}
                onChange={(e) => setShowName(e.target.checked)}
              />
              <Switch
                label="Show the sex while waiting"
                checked={showSex}
                onChange={(e) => setShowSex(e.target.checked)}
              />
            </div>
          </Card>
        </div>
        <section className={styles.preview} aria-labelledby={previewId}>
          <h2 id={previewId} className={styles.previewTitle}>
            Your page
          </h2>
          <PagePreview view={preview} theme={settings.theme} />
        </section>
        <div className={styles.actions}>
          <StatusMessage tone="danger">{error}</StatusMessage>
          <Button variant="primary" type="submit" icon="sparkles" loading={loading}>
            {loading ? 'Creating…' : 'Create site'}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
