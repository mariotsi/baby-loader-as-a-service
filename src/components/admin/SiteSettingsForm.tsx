'use client';

import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { type SubmitEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { Field } from '@/components/ui/Field';
import { FontPicker } from '@/components/ui/FontPicker';
import { Input } from '@/components/ui/Input';
import { LanguagesPicker } from '@/components/ui/LanguagesPicker';
import { PalettePicker } from '@/components/ui/PalettePicker';
import { PerLanguageField } from '@/components/ui/PerLanguageField';
import { Select } from '@/components/ui/Select';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import type { Lang } from '@/lib/i18n';
import type { Milestone, SiteDTO } from '@/lib/site';
import {
  type BirthDetails,
  DEFAULT_MILESTONE_EMOJI,
  type PageName,
  parseSiteSettings,
  type SiteSettingsError,
  type SiteSettingsInput,
} from '@/lib/siteSettings';
import styles from './SiteSettingsForm.module.css';
import { describeSiteSettingsErrors, inlineErrorText, isInlineError } from './siteSettingsErrorText';

const LOCAL_DATETIME = "yyyy-MM-dd'T'HH:mm";

/** An example label in each Language a Site can speak. */
const MILESTONE_PLACEHOLDER: Record<Lang, string> = { en: 'The first kick', it: 'Il primo calcio' };

/**
 * The texts written, one per language, as the Birth message, the Page name
 * and a Milestone's label hold them: a text in a Language the Site no longer
 * speaks is kept.
 */
function writtenTexts(texts: Partial<Record<Lang, string>>): Partial<Record<Lang, string>> {
  return Object.fromEntries(Object.entries(texts).filter(([, text]) => text.trim()));
}

/** `timeZones` comes from the server, so the list the page renders matches the one it hydrates. */
export function SiteSettingsForm({ site, timeZones }: { site: SiteDTO; timeZones: string[] }) {
  const router = useRouter();
  const [babyName, setBabyName] = useState(site.babyName);
  const [sex, setSex] = useState(site.sex);
  const [dueDate, setDueDate] = useState(site.dueDate?.slice(0, 10) ?? '');
  const details = site.birth.details;
  const [born, setBorn] = useState(site.birth.born);
  const [birthDatetime, setBirthDatetime] = useState(details ? format(parseISO(details.datetime), LOCAL_DATETIME) : '');
  const [weight, setWeight] = useState(details?.weightGrams?.toString() ?? '');
  const [lengthCm, setLengthCm] = useState(details?.lengthCm?.toString() ?? '');
  const [birthMessage, setBirthMessage] = useState<BirthDetails['message']>(details?.message ?? {});
  const [languages, setLanguages] = useState<Lang[]>(site.languages);
  const [timezone, setTimezone] = useState(site.timezone);
  const [palette, setPalette] = useState(site.theme.palette);
  const [font, setFont] = useState(site.theme.font);
  const [showName, setShowName] = useState(site.privacy.showName);
  const [showSex, setShowSex] = useState(site.privacy.showSex);
  const [pageName, setPageName] = useState<PageName>(site.pageName);
  const [milestones, setMilestones] = useState<Milestone[]>(site.milestones);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** The fields in error at the last failed save, checked again on every edit until they pass. */
  const [failedPaths, setFailedPaths] = useState<string[]>([]);
  /** Counts failed saves, so each one moves the focus to the first field in error. */
  const [failedSaves, setFailedSaves] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (failedSaves > 0) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [failedSaves]);

  function currentSettings(): SiteSettingsInput {
    return {
      babyName,
      sex,
      dueDate: dueDate || null,
      birth: born
        ? {
            born: true,
            details: {
              datetime: birthDatetime ? parseISO(birthDatetime).toISOString() : '',
              weightGrams: weight ? Number(weight) : null,
              lengthCm: lengthCm ? Number(lengthCm) : null,
              message: writtenTexts(birthMessage),
            },
          }
        : { born: false, details: null },
      milestones: milestones.map((m) => ({ ...m, label: writtenTexts(m.label) })),
      languages,
      timezone,
      theme: { palette, font },
      privacy: { showName, showSex },
      pageName: writtenTexts(pageName),
    };
  }

  // Only the fields that failed the last save are checked while the Owner fixes them: nothing new turns red mid-edit.
  const errors = failedPaths.length > 0 ? stillFailing(parseSiteSettings(currentSettings()), failedPaths) : [];

  function inlineError(path: string): string | undefined {
    const error = errors.find((e) => e.path === path);
    return error ? inlineErrorText(error, languages) : undefined;
  }

  function errorsPerLanguage(path: string): Partial<Record<Lang, string>> {
    return Object.fromEntries(languages.map((lang) => [lang, inlineError(`${path}.${lang}`)]));
  }

  function fail(failed: SiteSettingsError[]) {
    setFailedPaths(failed.map((error) => error.path));
    setFailedSaves((count) => count + 1);
  }

  async function save(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const settings = currentSettings();
    const checked = parseSiteSettings(settings);
    if (!checked.ok) {
      fail(checked.errors);
      return;
    }
    setFailedPaths([]);
    setSaving(true);
    const res = await fetch(`/api/sites/${site.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) {
      setMessage('Saved.');
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      if (data?.errors) {
        fail(data.errors);
      } else {
        setMessage(data?.error || 'Something went wrong.');
      }
    }
  }

  const saved = message === 'Saved.';

  return (
    <form ref={formRef} onSubmit={save} className={styles.form} noValidate>
      <div className={styles.columns}>
        <div className={styles.column}>
          <Card title="Baby details" description="What your page says about the little one.">
            <Field label="Name">
              <Input value={babyName} onChange={(e) => setBabyName(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Sex">
              <Select value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}>
                <option value="unknown">Prefer not to say</option>
                <option value="female">Girl</option>
                <option value="male">Boy</option>
              </Select>
            </Field>
            <Field label="Due date" optional>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Checkbox
              label="The baby has been born"
              hint="Your page switches from the Countdown to the Birth details."
              checked={born}
              onChange={(e) => setBorn(e.target.checked)}
            />
            {born ? (
              <>
                <Field label="Birth date & time">
                  <Input
                    type="datetime-local"
                    value={birthDatetime}
                    onChange={(e) => setBirthDatetime(e.target.value)}
                  />
                </Field>
                <div className={styles.pair}>
                  <Field label="Weight (g)" optional>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </Field>
                  <Field label="Length (cm)" optional>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={lengthCm}
                      onChange={(e) => setLengthCm(e.target.value)}
                    />
                  </Field>
                </div>
                <PerLanguageField
                  label="Message"
                  languages={languages}
                  value={birthMessage}
                  onChange={(lang, text) => setBirthMessage({ ...birthMessage, [lang]: text })}
                  errors={errorsPerLanguage('birth.details.message')}
                  optional
                >
                  {({ lang, value, onChange }) => (
                    <Textarea lang={lang} value={value} onChange={(e) => onChange(e.target.value)} />
                  )}
                </PerLanguageField>
              </>
            ) : null}
          </Card>

          <MilestonesCard
            milestones={milestones}
            onChange={setMilestones}
            languages={languages}
            inlineError={inlineError}
            errorsPerLanguage={errorsPerLanguage}
          />
        </div>

        <div className={styles.column}>
          <Card title="Appearance" description="The colors, letters and words of your page.">
            <PalettePicker value={palette} onChange={setPalette} />
            <FontPicker value={font} onChange={setFont} sample={babyName.trim() || 'Aa'} />
            <LanguagesPicker value={languages} onChange={setLanguages} />
            <PerLanguageField
              label="Page name"
              hint="Your names, or anything you'd like at the top of your page."
              languages={languages}
              value={pageName}
              onChange={(lang, text) => setPageName({ ...pageName, [lang]: text })}
              errors={errorsPerLanguage('pageName')}
              optional
            >
              {({ lang, value, onChange }) => (
                <Input
                  lang={lang}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="Stefania & Simone"
                  maxLength={60}
                  autoComplete="off"
                />
              )}
            </PerLanguageField>
            <Field label="Timezone" hint="The Countdown turns over at midnight here.">
              <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {(timeZones.includes(timezone) ? timeZones : [timezone, ...timeZones]).map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>
          <Card title="Who sees what" description="After the birth your page always shows the name and the sex.">
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
      </div>

      <div className={styles.saveBar}>
        <Button variant="primary" type="submit" loading={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <StatusMessage tone="success">{saved ? 'Saved. Your page is up to date.' : null}</StatusMessage>
        <StatusMessage tone="danger">{(message && !saved ? message : null) || problemsText(errors)}</StatusMessage>
      </div>
    </form>
  );
}

interface MilestonesCardProps {
  milestones: Milestone[];
  onChange: (milestones: Milestone[]) => void;
  languages: Lang[];
  inlineError: (path: string) => string | undefined;
  errorsPerLanguage: (path: string) => Partial<Record<Lang, string>>;
}

/** Every Milestone as a group: its emoji, its date and its label in each of the Site's Languages. */
function MilestonesCard({ milestones, onChange, languages, inlineError, errorsPerLanguage }: MilestonesCardProps) {
  function add() {
    onChange([...milestones, { emoji: DEFAULT_MILESTONE_EMOJI, label: {}, date: '' }]);
  }
  function update(i: number, patch: Partial<Milestone>) {
    onChange(milestones.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function remove(i: number) {
    onChange(milestones.filter((_, idx) => idx !== i));
  }

  return (
    <Card title="Milestones" description="The little moments of your story, in date order on your page.">
      {milestones.length > 0 ? (
        <ol className={styles.milestones}>
          {milestones.map((m, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Milestones have no id; each row edits and removes the Milestone at its index.
            <li key={i} className={styles.milestoneItem}>
              <fieldset className={styles.milestone}>
                <legend className={styles.milestoneLegend}>
                  <VisuallyHidden>Milestone {i + 1}</VisuallyHidden>
                </legend>
                <div className={styles.milestoneEmoji}>
                  <EmojiPicker
                    label={`Milestone ${i + 1} emoji`}
                    value={m.emoji}
                    onChange={(emoji) => update(i, { emoji })}
                  />
                </div>
                <Field
                  label="Date"
                  labelHidden
                  error={inlineError(`milestones.${i}.date`)}
                  className={styles.milestoneDate}
                >
                  <Input type="date" value={m.date} onChange={(e) => update(i, { date: e.target.value })} />
                </Field>
                <Button icon="trash" labelHidden className={styles.milestoneRemove} onClick={() => remove(i)}>
                  Remove milestone {i + 1}
                </Button>
                <div className={styles.milestoneLabel}>
                  <PerLanguageField
                    label="Label"
                    labelHidden
                    languages={languages}
                    value={m.label}
                    onChange={(lang, text) => update(i, { label: { ...m.label, [lang]: text } })}
                    errors={errorsPerLanguage(`milestones.${i}.label`)}
                  >
                    {({ lang, value, onChange: setText }) => (
                      <Input
                        lang={lang}
                        value={value}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={MILESTONE_PLACEHOLDER[lang]}
                      />
                    )}
                  </PerLanguageField>
                </div>
              </fieldset>
            </li>
          ))}
        </ol>
      ) : null}
      <div>
        <Button variant="ghost" icon="plus" onClick={add}>
          Add milestone
        </Button>
      </div>
    </Card>
  );
}

/** The status message for the errors still showing: a pointer to the fields marked, then every other error in words. */
function problemsText(errors: SiteSettingsError[]): string | null {
  const elsewhere = errors.filter((error) => !isInlineError(error.path));
  const parts = [
    errors.length > elsewhere.length ? 'Check the fields marked in red.' : null,
    elsewhere.length > 0 ? describeSiteSettingsErrors(elsewhere) : null,
  ];
  return parts.filter(Boolean).join(' ') || null;
}

function stillFailing(result: ReturnType<typeof parseSiteSettings>, paths: string[]): SiteSettingsError[] {
  return result.ok ? [] : result.errors.filter((error) => paths.includes(error.path));
}
