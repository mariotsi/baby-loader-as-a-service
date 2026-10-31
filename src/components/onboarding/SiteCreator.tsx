'use client';

import { useRouter } from 'next/navigation';
import { type Ref, type SubmitEvent, useEffect, useRef, useState } from 'react';
import { EditorPreview } from '@/components/dashboard/EditorPreview';
import { SiteIconField } from '@/components/dashboard/SiteIconField';
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
import { Select } from '@/components/ui/Select';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { StepProgress } from '@/components/ui/StepProgress';
import { Switch } from '@/components/ui/Switch';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { type AddressConfig, siteAddress, slugProblem } from '@/lib/address';
import { errorsCopy } from '@/lib/copy/errors';
import { type PlatformCopy, platformCopy } from '@/lib/copy/platform';
import { inlineErrorText, responseErrorText } from '@/lib/errorText';
import { type Lang, languageName } from '@/lib/i18n';
import { saveWelcome } from '@/lib/newSiteWelcome';
import {
  DEFAULT_SITE_ICON_EMOJI,
  defaultSiteSettings,
  type PageName,
  parseNewSite,
  parseSiteSettings,
  type SiteSettings,
  type SiteSettingsError,
  type SiteSettingsInput,
} from '@/lib/siteSettings';
import { DEFAULT_FONT, DEFAULT_PALETTE } from '@/lib/theme';
import styles from './SiteCreator.module.css';

const LAST_STEP = 3;
const DRAFT_KEY = 'new-site-draft';

/** Everything entered so far, kept in the tab's `sessionStorage` so a reload loses none of it. */
interface Draft {
  slug: string;
  babyName: string;
  sex: SiteSettingsInput['sex'];
  dueDate: string;
  languages: Lang[];
  palette: string;
  font: string;
  pageName: PageName;
  iconIsEmoji: boolean;
  iconEmoji: string;
  showName: boolean;
  showSex: boolean;
}

/** The fields of The basics that show an error, by name. */
type BasicsErrors = Partial<Record<'slug' | 'babyName' | 'dueDate', string>>;

function readDraft(): Draft | null {
  try {
    const saved = sessionStorage.getItem(DRAFT_KEY);
    return saved ? JSON.parse(saved) : null;
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

function toSettings(draft: Draft): SiteSettingsInput {
  return {
    ...defaultSiteSettings,
    babyName: draft.babyName,
    sex: draft.sex,
    dueDate: draft.dueDate || null,
    languages: draft.languages,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    theme: { palette: draft.palette, font: draft.font },
    privacy: { showName: draft.showName, showSex: draft.showSex },
    pageName: Object.fromEntries(Object.entries(draft.pageName).filter(([, text]) => text.trim())),
    icon: draft.iconIsEmoji ? draft.iconEmoji : null,
  };
}

/** The errors of The basics: what the browser can check before asking the server about the Slug. */
function basicsErrors(draft: Draft, lang: Lang): BasicsErrors {
  const t = platformCopy[lang].onboarding;
  const slug = draft.slug.trim();
  const checked = parseNewSite({ slug, settings: toSettings(draft) });
  const dueDate = checked.ok ? undefined : checked.errors.find((error) => error.path === 'settings.dueDate');
  return {
    slug: slugError(slug, t) ?? (slug ? undefined : t.slugFormat),
    babyName: draft.babyName.trim() ? undefined : t.babyNameRequired,
    dueDate: dueDate ? inlineErrorText({ ...dueDate, path: 'dueDate' }, draft.languages, lang) : undefined,
  };
}

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
  bornPlaceholderUrl: string;
}) {
  const router = useRouter();
  const lang = useLang();
  const { onboarding: t, settings: settingsCopy, privacy } = platformCopy[lang];
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    slug: '',
    babyName: '',
    sex: 'unknown',
    dueDate: '',
    // A new Site starts in the language its Owner reads the Platform in.
    languages: [lang],
    palette: DEFAULT_PALETTE,
    font: DEFAULT_FONT,
    pageName: {},
    iconIsEmoji: false,
    iconEmoji: DEFAULT_SITE_ICON_EMOJI,
    showName: true,
    showSex: true,
  });
  const [fieldErrors, setFieldErrors] = useState<BasicsErrors>({});
  /** Counts refused steps, so each one moves the focus to the first field in error. */
  const [refused, setRefused] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(0);
  /** Set once the saved draft is back, so the empty form never overwrites it. */
  const [restored, setRestored] = useState(false);
  const lastValid = useRef<SiteSettings>(defaultSiteSettings as SiteSettings);

  const settings = toSettings(draft);
  const checked = parseSiteSettings(settings);
  if (checked.ok) {
    lastValid.current = checked.value;
  }
  const trimmedSlug = draft.slug.trim();

  useEffect(() => {
    const saved = readDraft();
    if (saved) {
      setDraft(saved);
      setStep(stepInUrl());
    } else if (location.search) {
      history.replaceState(null, '', location.pathname);
    }
    setRestored(true);
    const followHistory = () => setStep(stepInUrl());
    window.addEventListener('popstate', followHistory);
    return () => window.removeEventListener('popstate', followHistory);
  }, []);

  useEffect(() => {
    if (restored) {
      writeDraft(draft);
    }
  }, [draft, restored]);

  useEffect(() => {
    if (step !== shownStep.current) {
      shownStep.current = step;
      headingRef.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    if (refused > 0) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [refused]);

  function update(patch: Partial<Draft>) {
    setDraft({ ...draft, ...patch });
  }

  function goTo(next: number) {
    setMessage(null);
    setStep(next);
    history.pushState(null, '', next === 0 ? location.pathname : `?step=${next + 1}`);
  }

  function refuse(errors: BasicsErrors) {
    setFieldErrors(errors);
    setRefused((count) => count + 1);
  }

  async function leaveBasics() {
    const errors = basicsErrors(draft, lang);
    if (Object.values(errors).some(Boolean)) {
      refuse(errors);
      return;
    }
    setBusy(true);
    const free = await slugIsFree(trimmedSlug);
    setBusy(false);
    if (free) {
      setFieldErrors({});
      goTo(1);
    } else {
      refuse({ slug: takenText(lang) });
    }
  }

  async function create() {
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: draft.slug, settings }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) {
      writeDraft(null);
      saveWelcome(data.site.slug);
      router.push(`/dashboard/${data.site.slug}`);
      return;
    }
    const errors: SiteSettingsError[] = data?.errors ?? [];
    if (errors.some((error) => error.path === 'slug')) {
      goTo(0);
      refuse({ slug: responseErrorText(data, lang) });
    } else {
      setMessage(res ? responseErrorText(data, lang) : errorsCopy[lang].generic);
    }
  }

  function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === 0) {
      void leaveBasics();
    } else if (step < LAST_STEP) {
      goTo(step + 1);
    } else {
      void create();
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
        <form ref={formRef} onSubmit={onSubmit} className={styles.form} noValidate>
          <StepProgress label={t.stepsLabel} steps={stepNames} current={step} />
          {step === 0 ? (
            <BasicsStep
              draft={draft}
              update={update}
              errors={fieldErrors}
              onErrors={setFieldErrors}
              address={address}
              headingRef={headingRef}
            />
          ) : null}
          {step === 1 ? (
            <Card title={t.makeItYours} description={t.makeItYoursDescription} headingRef={headingRef}>
              <PalettePicker value={draft.palette} onChange={(palette) => update({ palette })} />
              <FontPicker
                value={draft.font}
                onChange={(font) => update({ font })}
                sample={draft.babyName.trim() || 'Aa'}
              />
              <LanguagesPicker value={draft.languages} onChange={(languages) => update({ languages })} />
              <PerLanguageField
                label={settingsCopy.pageName}
                hint={settingsCopy.pageNameHint}
                languages={draft.languages}
                value={draft.pageName}
                onChange={(language, text) => update({ pageName: { ...draft.pageName, [language]: text } })}
                optional
              >
                {({ lang: language, value, onChange }) => (
                  <Input
                    lang={language}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={platformCopy[language].settings.pageNamePlaceholder}
                    maxLength={60}
                    autoComplete="off"
                  />
                )}
              </PerLanguageField>
              <SiteIconField
                isEmoji={draft.iconIsEmoji}
                onIsEmojiChange={(iconIsEmoji) => update({ iconIsEmoji })}
                emoji={draft.iconEmoji}
                onEmojiChange={(iconEmoji) => update({ iconEmoji })}
              />
            </Card>
          ) : null}
          {step === 2 ? (
            <Card title={t.whoSeesWhat} description={t.whoSeesWhatDescription} headingRef={headingRef}>
              <div>
                <Switch
                  label={privacy.showName}
                  checked={draft.showName}
                  onChange={(e) => update({ showName: e.target.checked })}
                />
                <Switch
                  label={privacy.showSex}
                  checked={draft.showSex}
                  onChange={(e) => update({ showSex: e.target.checked })}
                />
              </div>
            </Card>
          ) : null}
          {step === LAST_STEP ? (
            <LastLookStep draft={draft} address={address} onChange={goTo} headingRef={headingRef} />
          ) : null}
          <div className={styles.actions}>
            {step > 0 ? <Button onClick={() => goTo(step - 1)}>{t.back}</Button> : null}
            <Button variant="primary" type="submit" icon={step === LAST_STEP ? 'plus' : undefined} loading={busy}>
              {submitLabel(step, busy, t)}
            </Button>
            <StatusMessage tone="danger">{message}</StatusMessage>
          </div>
        </form>
        <EditorPreview
          settings={lastValid.current}
          slug={trimmedSlug || 'emma'}
          bornPlaceholderUrl={bornPlaceholderUrl}
        />
      </div>
    </PageShell>
  );
}

interface BasicsStepProps {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  errors: BasicsErrors;
  onErrors: (errors: BasicsErrors) => void;
  address: string;
  headingRef: Ref<HTMLHeadingElement>;
}

/** The Site address, the baby's name, the Sex and the Due date. An error clears as its field changes. */
function BasicsStep({ draft, update, errors, onErrors, address, headingRef }: BasicsStepProps) {
  const { onboarding: t, settings } = platformCopy[useLang()];
  const slugProblemText = slugError(draft.slug.trim(), t) ?? errors.slug;
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
          value={draft.slug}
          onChange={(e) => {
            update({ slug: e.target.value.toLowerCase() });
            onErrors({ ...errors, slug: undefined });
          }}
          placeholder="emma"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </Field>
      <Field label={t.babyName} error={errors.babyName} required>
        <Input
          value={draft.babyName}
          onChange={(e) => {
            update({ babyName: e.target.value });
            onErrors({ ...errors, babyName: undefined });
          }}
          autoComplete="off"
        />
      </Field>
      <Field label={settings.sex}>
        <Select value={draft.sex} onChange={(e) => update({ sex: e.target.value as Draft['sex'] })}>
          <option value="unknown">{settings.sexUnknown}</option>
          <option value="female">{settings.sexFemale}</option>
          <option value="male">{settings.sexMale}</option>
        </Select>
      </Field>
      <Field label={t.dueDate} optional hint={t.dueDateHint} error={errors.dueDate}>
        <Input
          type="date"
          value={draft.dueDate}
          onChange={(e) => {
            update({ dueDate: e.target.value });
            onErrors({ ...errors, dueDate: undefined });
          }}
        />
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

/** What the page will say, with a way back to the step that holds each part. */
function LastLookStep({ draft, address, onChange, headingRef }: LastLookStepProps) {
  const lang = useLang();
  const t = platformCopy[lang].onboarding;
  return (
    <Card title={t.lastLook} description={t.lastLookDescription} headingRef={headingRef}>
      <dl className={styles.summary}>
        <SummaryRow
          label={t.basics}
          value={`${draft.babyName}, ${address.replace(/^https?:\/\//, '')}`}
          onChange={() => onChange(0)}
        />
        <SummaryRow
          label={t.makeItYours}
          value={draft.languages.map((language) => languageName(language, lang)).join(', ')}
          onChange={() => onChange(1)}
        />
        <SummaryRow
          label={t.whoSeesWhat}
          value={[draft.showName ? t.nameShown : t.nameHidden, draft.showSex ? t.sexShown : t.sexHidden].join(', ')}
          onChange={() => onChange(2)}
        />
      </dl>
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

function SummaryRow({ label, value, onChange }: { label: string; value: string; onChange: () => void }) {
  const t = platformCopy[useLang()].onboarding;
  return (
    <div className={styles.summaryRow}>
      <div>
        <dt className={styles.summaryLabel}>{label}</dt>
        <dd className={styles.summaryValue}>{value}</dd>
      </div>
      <Button variant="ghost" size="sm" onClick={onChange}>
        {t.change}
        <VisuallyHidden> {label}</VisuallyHidden>
      </Button>
    </div>
  );
}
