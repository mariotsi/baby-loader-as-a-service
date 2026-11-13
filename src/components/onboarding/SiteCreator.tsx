'use client';

import { toNestErrors } from '@hookform/resolvers';
import { parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { type Ref, useEffect, useRef, useState } from 'react';
import { Controller, FormProvider, type Resolver, useForm, useFormContext, useWatch } from 'react-hook-form';
import { EditorPreview } from '@/components/dashboard/EditorPreview';
import { PrivacySwitches } from '@/components/dashboard/PrivacySwitches';
import { SiteIconField } from '@/components/dashboard/SiteIconField';
import { usePhonePreview } from '@/components/dashboard/usePhonePreview';
import { useLang } from '@/components/LangProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { FontPicker } from '@/components/ui/FontPicker';
import { Input } from '@/components/ui/Input';
import { LanguagesPicker } from '@/components/ui/LanguagesPicker';
import { PageShell } from '@/components/ui/PageShell';
import { PalettePicker } from '@/components/ui/PalettePicker';
import { PerLanguageField } from '@/components/ui/PerLanguageField';
import { PhoneStrip } from '@/components/ui/PhoneStrip';
import { Select } from '@/components/ui/Select';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { StepProgress } from '@/components/ui/StepProgress';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { type AddressConfig, siteAddress, slugProblem } from '@/lib/address';
import type { MediaUrl } from '@/lib/birthMedia';
import { errorsCopy } from '@/lib/copy/errors';
import { type PlatformCopy, platformCopy } from '@/lib/copy/platform';
import { uiCopy } from '@/lib/copy/ui';
import { inlineErrorText, responseErrorText, settingOf } from '@/lib/errorText';
import { type Lang, languageName } from '@/lib/i18n';
import { saveWelcome } from '@/lib/newSiteWelcome';
import { lastValidSettings, newSiteDraft, readStoredDraft, type SiteDraft, settingsOfDraft } from '@/lib/siteDraft';
import { defaultSiteSettings, parseNewSite, type SiteSettings, type SiteSettingsError } from '@/lib/siteSettings';
import { getFont, getPalette } from '@/lib/theme';
import styles from './SiteCreator.module.css';

const LAST_STEP = 3;
const DRAFT_KEY = 'new-site-draft';

/** Everything entered so far, kept in the tab's `sessionStorage` so a reload loses none of it. */
type Draft = SiteDraft & { slug: string };

/** The fields of The basics that show an error, by name. */
const BASICS = ['slug', 'dueDate'] as const;
type BasicsErrors = Partial<Record<(typeof BASICS)[number], string>>;

/** The draft this tab saved, if it still has the shape this page writes; one from an older Platform starts over. */
function readDraft(): Draft | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null');
    const draft = readStoredDraft(saved);
    return draft && typeof saved.slug === 'string' ? { ...draft, slug: saved.slug } : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft) {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } else {
      sessionStorage.removeItem(DRAFT_KEY);
    }
  } catch {
    // Without storage the form still works; a reload starts it over.
  }
}

/** The step the URL names: `?step=2` is the second, and no `step` the first. */
function stepInUrl(): number {
  const step = Number(new URLSearchParams(location.search).get('step'));
  return Number.isInteger(step) && step >= 1 && step <= LAST_STEP + 1 ? step - 1 : 0;
}

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

/** The errors of The basics: what the browser can check before asking the server about the Slug. */
function basicsErrors(draft: Draft, lang: Lang): BasicsErrors {
  const t = platformCopy[lang].onboarding;
  const slug = draft.slug.trim();
  const checked = parseNewSite({ slug, settings: settingsOfDraft(draft) });
  const dueDate = checked.ok ? undefined : checked.errors.find((error) => settingOf(error.path) === 'dueDate');
  return {
    slug: slugError(slug, t) ?? (slug ? undefined : t.slugFormat),
    dueDate: dueDateError(draft, dueDate, lang),
  };
}

function dueDateError(draft: Draft, error: SiteSettingsError | undefined, lang: Lang): string | undefined {
  if (!draft.dueDate) {
    return platformCopy[lang].onboarding.dueDateRequired;
  }
  return error ? inlineErrorText(error, draft.languages, lang) : undefined;
}

/**
 * The form's rules: The basics, whichever step is showing, since every later
 * step only picks among valid options. Each error is worded for under its
 * field, in the language the form passes as its context.
 */
const basicsResolver: Resolver<Draft, { lang: Lang }> = (values, context, options) => {
  const found = Object.entries(basicsErrors(values, context?.lang ?? 'en')).filter(([, message]) => message);
  if (found.length === 0) {
    return { values, errors: {} };
  }
  const errors = Object.fromEntries(found.map(([name, message]) => [name, { type: 'basics', message }]));
  return { values: {}, errors: toNestErrors(errors, options) };
};

async function slugIsFree(slug: string): Promise<boolean> {
  const res = await fetch(`/api/slug-available?slug=${encodeURIComponent(slug)}`).catch(() => null);
  // The check only saves a trip back: if it fails, creating the Site still answers.
  return (await res?.json().catch(() => null))?.available ?? true;
}

/**
 * A new Site in four short steps, with its Public page beside them. Each step
 * is an entry in the browser's history, and what is entered survives a reload.
 * A new Site starts Waiting; Milestones and the Birth video wait for Site settings.
 *
 * `addressConfig` comes from the server page: only the server knows the root domain.
 */
export function SiteCreator({
  addressConfig,
  bornPlaceholderUrl,
}: {
  addressConfig: AddressConfig;
  /** What the Public page shows in place of a birth photo, which depends on the deployment. */
  bornPlaceholderUrl: MediaUrl;
}) {
  const router = useRouter();
  const lang = useLang();
  const { onboarding: t, settings: settingsCopy } = platformCopy[lang];
  const [step, setStep] = useState(0);
  const form = useForm<Draft, { lang: Lang }>({
    defaultValues: { ...newSiteDraft(lang, Intl.DateTimeFormat().resolvedOptions().timeZone), slug: '' },
    resolver: basicsResolver,
    context: { lang },
  });
  const { register, control, handleSubmit, setValue, setError, setFocus, getFieldState, clearErrors, reset } = form;
  const { isSubmitting, errors } = form.formState;
  // Every value has a default, so what the form holds is always a whole draft.
  const draft = useWatch({ control }) as Draft;
  const preview = usePhonePreview();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(0);
  /** Set once the saved draft is back, so the empty form never overwrites it. */
  const [restored, setRestored] = useState(false);
  const lastValid = useRef<SiteSettings>(defaultSiteSettings);

  const settings = settingsOfDraft(draft);
  lastValid.current = lastValidSettings(settings, lastValid.current);
  const trimmedSlug = draft.slug.trim();

  useEffect(() => {
    const saved = readDraft();
    if (saved) {
      reset(saved);
      setStep(stepInUrl());
    } else if (location.search) {
      history.replaceState(null, '', location.pathname);
    }
    setRestored(true);
    const followHistory = () => setStep(stepInUrl());
    window.addEventListener('popstate', followHistory);
    return () => window.removeEventListener('popstate', followHistory);
  }, [reset]);

  useEffect(() => {
    if (restored) {
      writeDraft(draft);
    }
  }, [draft, restored]);

  // A new step starts at its heading; The basics, when a field there is in error, start at that field.
  useEffect(() => {
    if (step !== shownStep.current) {
      shownStep.current = step;
      const inError = step === 0 ? BASICS.find((name) => getFieldState(name).error) : undefined;
      if (inError) {
        setFocus(inError);
      } else {
        headingRef.current?.focus();
      }
    }
  }, [step, getFieldState, setFocus]);

  function goTo(next: number) {
    clearErrors('root');
    setStep(next);
    history.pushState(null, '', next === 0 ? location.pathname : `?step=${next + 1}`);
  }

  async function leaveBasics() {
    if (await slugIsFree(trimmedSlug)) {
      goTo(1);
    } else {
      setError('slug', { type: 'slugTaken', message: takenText(lang) }, { shouldFocus: true });
    }
  }

  async function create() {
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: draft.slug, settings }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok) {
      writeDraft(null);
      saveWelcome(data.site.slug);
      router.push(`/dashboard/${data.site.slug}`);
      return;
    }
    const refused: SiteSettingsError[] = data?.errors ?? [];
    if (refused.some((error) => error.path === 'slug')) {
      goTo(0);
      setError('slug', { type: 'refused', message: responseErrorText(data, lang) });
    } else {
      setError('root.server', { message: res ? responseErrorText(data, lang) : errorsCopy[lang].generic });
    }
  }

  /** What the forward button does once The basics pass their rules. */
  function forward() {
    if (step === 0) {
      return leaveBasics();
    }
    if (step < LAST_STEP) {
      return goTo(step + 1);
    }
    return create();
  }

  /** A draft restored from an earlier day can fail the rules on a later step: The basics show why. */
  function backToBasics() {
    if (step > 0) {
      goTo(0);
    }
  }

  const stepNames = [t.basics, t.makeItYours, t.whoSeesWhat, t.lastLook];
  const address = siteAddress(trimmedSlug || 'emma', addressConfig);

  return (
    <PageShell width="wide">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1 className={styles.title}>{t.title}</h1>
        <p className={styles.lead}>{t.lead}</p>
      </div>
      <div className={styles.layout}>
        <PhoneStrip
          showLabel={settingsCopy.previewShow}
          hideLabel={settingsCopy.previewHide}
          open={preview.open}
          onToggle={preview.toggle}
          controls={preview.id}
        >
          {t.stepOf(step + 1, LAST_STEP + 1)}
        </PhoneStrip>
        <form
          onSubmit={(e) => void handleSubmit(forward, backToBasics)(e)}
          className={styles.form}
          inert={preview.open}
          noValidate
        >
          <StepProgress label={t.stepsLabel} steps={stepNames} current={step} />
          {step === 0 ? (
            <FormProvider {...form}>
              <BasicsStep address={address} headingRef={headingRef} />
            </FormProvider>
          ) : null}
          {step === 1 ? (
            <Card title={t.makeItYours} description={t.makeItYoursDescription} headingRef={headingRef}>
              <Controller
                control={control}
                name="palette"
                render={({ field }) => <PalettePicker value={field.value} onChange={field.onChange} />}
              />
              <Controller
                control={control}
                name="font"
                render={({ field }) => (
                  <FontPicker value={field.value} onChange={field.onChange} sample={draft.babyName.trim() || 'Aa'} />
                )}
              />
              <Controller
                control={control}
                name="languages"
                render={({ field }) => <LanguagesPicker value={field.value} onChange={field.onChange} />}
              />
              <PerLanguageField
                label={settingsCopy.pageName}
                hint={settingsCopy.pageNameHint}
                languages={draft.languages}
                optional
              >
                {({ lang: language }) => (
                  <Input
                    lang={language}
                    placeholder={platformCopy[language].settings.pageNamePlaceholder}
                    maxLength={60}
                    autoComplete="off"
                    {...register(`pageName.${language}`)}
                  />
                )}
              </PerLanguageField>
              <SiteIconField
                isEmoji={draft.iconIsEmoji}
                onIsEmojiChange={(iconIsEmoji) => setValue('iconIsEmoji', iconIsEmoji)}
                emoji={draft.iconEmoji}
                onEmojiChange={(iconEmoji) => setValue('iconEmoji', iconEmoji)}
              />
            </Card>
          ) : null}
          {step === 2 ? (
            <Card title={t.whoSeesWhat} description={t.whoSeesWhatDescription} headingRef={headingRef}>
              <PrivacySwitches
                babyName={draft.babyName}
                sex={draft.sex}
                showName={draft.showName}
                showSex={draft.showSex}
                onShowName={(showName) => setValue('showName', showName)}
                onShowSex={(showSex) => setValue('showSex', showSex)}
              />
            </Card>
          ) : null}
          {step === LAST_STEP ? (
            <LastLookStep draft={draft} address={address} onChange={goTo} headingRef={headingRef} />
          ) : null}
          <div className={styles.actions}>
            <div className={styles.buttons}>
              {step > 0 ? <Button onClick={() => goTo(step - 1)}>{t.back}</Button> : null}
              <Button
                className={styles.forward}
                variant="primary"
                type="submit"
                icon={step === LAST_STEP ? 'plus' : undefined}
                loading={isSubmitting}
              >
                {submitLabel(step, isSubmitting, t)}
              </Button>
            </div>
            <StatusMessage tone="danger">{errors.root?.server?.message}</StatusMessage>
          </div>
        </form>
        <EditorPreview
          settings={lastValid.current}
          slug={trimmedSlug || 'emma'}
          bornPlaceholderUrl={bornPlaceholderUrl}
          open={preview.open}
          id={preview.id}
        />
      </div>
    </PageShell>
  );
}

interface BasicsStepProps {
  address: string;
  headingRef: Ref<HTMLHeadingElement>;
}

/**
 * The Site address, the baby's name, the Sex and the Due date, as fields of
 * the form around them. The Address says at once when it cannot be one; the
 * form's other errors show after the first try to go on.
 */
function BasicsStep({ address, headingRef }: BasicsStepProps) {
  const { onboarding: t, settings } = platformCopy[useLang()];
  const { register, control, setValue, formState } = useFormContext<Draft>();
  const slug = useWatch({ control, name: 'slug' });
  const slugProblemText = slugError(slug.trim(), t) ?? formState.errors.slug?.message;
  return (
    <Card title={t.basics} description={t.basicsDescription} headingRef={headingRef}>
      <Field
        label={t.siteAddress}
        hint={slugProblemText ? undefined : t.pageWillBeAt(address)}
        error={slugProblemText}
        liveHint
        required
      >
        <Input
          placeholder="emma"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          {...register('slug', { onChange: (e) => setValue('slug', e.target.value.toLowerCase()) })}
        />
      </Field>
      <Field label={t.babyName} hint={settings.nameHint} optional>
        <Input autoComplete="off" {...register('babyName')} />
      </Field>
      <Field label={settings.sex}>
        <Select {...register('sex')}>
          <option value="unknown">{settings.sexUnknown}</option>
          <option value="female">{settings.sexFemale}</option>
          <option value="male">{settings.sexMale}</option>
        </Select>
      </Field>
      <Field label={t.dueDate} hint={t.dueDateHint} error={formState.errors.dueDate?.message} required>
        <Input type="date" {...register('dueDate')} />
      </Field>
    </Card>
  );
}

interface LastLookStepProps {
  draft: Draft;
  address: string;
  onChange: (step: number) => void;
  headingRef: Ref<HTMLHeadingElement>;
}

/** Everything entered, step by step, with a way back to each step. */
function LastLookStep({ draft, address, onChange, headingRef }: LastLookStepProps) {
  const lang = useLang();
  const { onboarding: t, settings, privacy } = platformCopy[lang];
  const ui = uiCopy[lang];
  const pageName = draft.languages.map((language) => draft.pageName[language]?.trim()).filter(Boolean);
  const dueDate = draft.dueDate
    ? new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(parseISO(draft.dueDate))
    : t.notSet;
  const sex = { unknown: settings.sexUnknown, female: settings.sexFemale, male: settings.sexMale }[draft.sex];
  return (
    <Card title={t.lastLook} description={t.lastLookDescription} headingRef={headingRef}>
      <SummaryGroup
        label={t.basics}
        onChange={() => onChange(0)}
        rows={[
          [t.siteAddress, address.replace(/^https?:\/\//, '')],
          [t.babyName, draft.babyName.trim() || t.notSet],
          [settings.sex, sex],
          [t.dueDate, dueDate],
        ]}
      />
      <SummaryGroup
        label={t.makeItYours}
        onChange={() => onChange(1)}
        rows={[
          [ui.palette, getPalette(draft.palette).name],
          [ui.font, getFont(draft.font).name],
          [ui.languages.legend, draft.languages.map((language) => languageName(language, lang)).join(', ')],
          [settings.pageName, pageName.join(', ') || t.notSet],
          [settings.siteIcon, draft.iconIsEmoji ? draft.iconEmoji : settings.siteIconLoadingBaby],
        ]}
      />
      <SummaryGroup
        label={t.whoSeesWhat}
        onChange={() => onChange(2)}
        rows={[
          [privacy.showName, draft.showName && draft.babyName.trim() ? t.yes : t.no],
          [privacy.showSex, draft.showSex && draft.sex !== 'unknown' ? t.yes : t.no],
        ]}
      />
    </Card>
  );
}

function takenText(lang: Lang): string {
  return responseErrorText({ errors: [{ path: 'slug', code: 'slugTaken' }] }, lang);
}

function submitLabel(step: number, busy: boolean, t: PlatformCopy['onboarding']): string {
  if (step < LAST_STEP) {
    return t.next;
  }
  return busy ? t.creating : t.create;
}

interface SummaryGroupProps {
  label: string;
  rows: [label: string, value: string][];
  onChange: () => void;
}

function SummaryGroup({ label, rows, onChange }: SummaryGroupProps) {
  const t = platformCopy[useLang()].onboarding;
  return (
    <section className={styles.summaryGroup} aria-label={label}>
      <div className={styles.summaryHeader}>
        <h3 className={styles.summaryTitle}>{label}</h3>
        <Button variant="ghost" size="sm" onClick={onChange}>
          {t.change}
          <VisuallyHidden> {label}</VisuallyHidden>
        </Button>
      </div>
      <dl className={styles.summary}>
        {rows.map(([name, value]) => (
          <div key={name} className={styles.summaryRow}>
            <dt className={styles.summaryLabel}>{name}</dt>
            <dd className={styles.summaryValue}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
