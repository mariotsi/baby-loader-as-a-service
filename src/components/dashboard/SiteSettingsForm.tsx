'use client';

import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { type SubmitEvent, useEffect, useRef, useState } from 'react';
import { useLang } from '@/components/LangProvider';
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
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { errorsCopy } from '@/lib/copy/errors';
import { platformCopy } from '@/lib/copy/platform';
import { describeSiteSettingsErrors, inlineErrorText, isInlineError, routeErrorText } from '@/lib/errorText';
import type { Lang } from '@/lib/i18n';
import type { Milestone, SiteDTO } from '@/lib/site';
import {
  type BirthDetails,
  type BirthMedia,
  DEFAULT_MILESTONE_EMOJI,
  DEFAULT_SITE_ICON_EMOJI,
  type PageName,
  parseSiteSettings,
  type SiteSettings,
  type SiteSettingsError,
  type SiteSettingsInput,
} from '@/lib/siteSettings';
import { BirthMediaEditor, birthPhoto, type MediaDraft, storedDraft } from './BirthMediaEditor';
import { PlaceField } from './PlaceField';
import { SitePreviews } from './SitePreviews';
import styles from './SiteSettingsForm.module.css';

const LOCAL_DATETIME = "yyyy-MM-dd'T'HH:mm";

/**
 * The texts written, one per language, as the Birth message, the Page name
 * and a Milestone's label hold them: a text in a Language the Site no longer
 * speaks is kept.
 */
function writtenTexts(texts: Partial<Record<Lang, string>>): Partial<Record<Lang, string>> {
  return Object.fromEntries(Object.entries(texts).filter(([, text]) => text.trim()));
}

/** A Milestone as the editor holds it: with the text in its Place field, which is not yet a Place while being typed. */
type MilestoneDraft = Milestone & { placeText: string };

/**
 * The Place fields holding text that was never picked from the suggestions.
 * Only the editor knows about them, so the rule runs beside Site settings'.
 */
function unpickedPlaces(milestones: MilestoneDraft[]): SiteSettingsError[] {
  return milestones.flatMap((m, i): SiteSettingsError[] =>
    m.placeText.trim() && !m.place ? [{ path: `milestones.${i}.place`, code: 'invalidOption' }] : []
  );
}

/**
 * `timeZones` comes from the server, so the list the page renders matches the
 * one it hydrates. `address` is the Site's, which only the server knows.
 */
export function SiteSettingsForm({
  site,
  timeZones,
  address,
  mediaPreviewSlug,
}: {
  site: SiteDTO;
  timeZones: string[];
  address: string;
  mediaPreviewSlug?: string;
}) {
  const router = useRouter();
  const pageLang = useLang();
  const { settings: t, privacy } = platformCopy[pageLang];
  const [babyName, setBabyName] = useState(site.babyName);
  const [sex, setSex] = useState(site.sex);
  const [dueDate, setDueDate] = useState(site.dueDate?.slice(0, 10) ?? '');
  const details = site.birth.details;
  const [photo, setPhoto] = useState<MediaDraft>(birthPhoto(details));
  const [video, setVideo] = useState<MediaDraft>(site.birthVideo);
  const [savedMedia, setSavedMedia] = useState({ photo: birthPhoto(details), video: site.birthVideo });
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
  const [iconIsEmoji, setIconIsEmoji] = useState(site.icon !== null);
  /** Kept while the loading baby is picked, so switching back brings the emoji back. */
  const [iconEmoji, setIconEmoji] = useState(site.icon ?? DEFAULT_SITE_ICON_EMOJI);
  const [milestones, setMilestones] = useState<MilestoneDraft[]>(() =>
    site.milestones.map((m) => ({ ...m, placeText: m.place?.address ?? '' }))
  );
  const [saving, setSaving] = useState(false);
  /** Why the last save failed, when the server refused it for a reason the fields cannot show. */
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
              photo: storedDraft(photo),
            },
          }
        : { born: false, details: null },
      milestones: milestones.map(({ placeText: _, ...m }) => ({ ...m, label: writtenTexts(m.label) })),
      languages,
      timezone,
      theme: { palette, font },
      privacy: { showName, showSex },
      pageName: writtenTexts(pageName),
      icon: iconIsEmoji ? iconEmoji : null,
      birthVideo: storedDraft(video),
    };
  }

  /** The previews draw the Site settings as they stand, or as they last stood valid while a field is half filled. */
  const lastValid = useRef<SiteSettings>(site);
  const checkedNow = parseSiteSettings(currentSettings());
  if (checkedNow.ok) {
    lastValid.current = checkedNow.value;
  }

  /** Everything that stops a save: the Site settings rules, then Places typed and never picked. */
  function problems(): SiteSettingsError[] {
    const checked = parseSiteSettings(currentSettings());
    return [...(checked.ok ? [] : checked.errors), ...unpickedPlaces(milestones)];
  }

  // Only the fields that failed the last save are checked while the Owner fixes them: nothing new turns red mid-edit.
  const errors = failedPaths.length > 0 ? problems().filter((error) => failedPaths.includes(error.path)) : [];

  function inlineError(path: string): string | undefined {
    const error = errors.find((e) => e.path === path);
    return error ? inlineErrorText(error, languages, pageLang) : undefined;
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
    setSaved(false);
    const found = problems();
    if (found.length > 0) {
      fail(found);
      return;
    }
    const settings = currentSettings();
    setFailedPaths([]);
    setSaving(true);
    const uploaded: { key: string; url: string }[] = [];
    let committed = false;
    async function upload(draft: MediaDraft) {
      if (!(draft instanceof File)) {
        return draft;
      }
      const body = new FormData();
      body.set('file', draft);
      const response = await fetch(`/api/sites/${site.slug}/media`, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(routeErrorText(data.error, pageLang));
      }
      uploaded.push(data.media);
      return { ...data.media, name: draft.name, type: draft.type, size: draft.size } as BirthMedia;
    }
    async function remove(key: string) {
      const response = await fetch(`/api/sites/${site.slug}/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (!response.ok) {
        throw new Error(routeErrorText((await response.json()).error, pageLang));
      }
    }
    try {
      const next = await prepareBirthMedia(settings, photo, video, upload);
      const res = await fetch(`/api/sites/${site.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.errors) {
          fail(data.errors);
        } else {
          setMessage(routeErrorText(data?.error, pageLang));
        }
        return;
      }
      committed = true;
      setPhoto(next.photo);
      setVideo(next.video);
      setSavedMedia(next);
      setSaved(true);
      router.refresh();
      await removeReplacedMedia(savedMedia, next, remove);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : routeErrorText(undefined, pageLang));
    } finally {
      if (!committed) {
        await Promise.allSettled(uploaded.map((media) => remove(media.key)));
      }
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={save} className={styles.form} noValidate>
      <div className={styles.columns}>
        <div className={styles.column}>
          <Card title={t.babyDetails} description={t.babyDetailsDescription}>
            <Field label={t.name}>
              <Input value={babyName} onChange={(e) => setBabyName(e.target.value)} autoComplete="off" />
            </Field>
            <Field label={t.sex}>
              <Select value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}>
                <option value="unknown">{t.sexUnknown}</option>
                <option value="female">{t.sexFemale}</option>
                <option value="male">{t.sexMale}</option>
              </Select>
            </Field>
            <Field label={t.dueDate} optional>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Checkbox label={t.born} hint={t.bornHint} checked={born} onChange={(e) => setBorn(e.target.checked)} />
            {born ? (
              <>
                <Field label={t.birthDatetime}>
                  <Input
                    type="datetime-local"
                    value={birthDatetime}
                    onChange={(e) => setBirthDatetime(e.target.value)}
                  />
                </Field>
                <div className={styles.pair}>
                  <Field label={t.weight} optional>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </Field>
                  <Field label={t.length} optional>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={lengthCm}
                      onChange={(e) => setLengthCm(e.target.value)}
                    />
                  </Field>
                </div>
                <PerLanguageField
                  label={t.message}
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

          <BirthMediaEditor
            previewSlug={mediaPreviewSlug}
            videoOnly
            photo={photo}
            video={video}
            onPhoto={setPhoto}
            onVideo={setVideo}
          />

          <MilestonesCard
            milestones={milestones}
            onChange={setMilestones}
            languages={languages}
            inlineError={inlineError}
            errorsPerLanguage={errorsPerLanguage}
          />
        </div>

        <div className={styles.column}>
          <Card title={t.appearance} description={t.appearanceDescription}>
            <PalettePicker value={palette} onChange={setPalette} />
            <FontPicker value={font} onChange={setFont} sample={babyName.trim() || 'Aa'} />
            <LanguagesPicker value={languages} onChange={setLanguages} />
            <PerLanguageField
              label={t.pageName}
              hint={t.pageNameHint}
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
                  placeholder={platformCopy[lang].settings.pageNamePlaceholder}
                  maxLength={60}
                  autoComplete="off"
                />
              )}
            </PerLanguageField>
            <Field label={t.timezone} hint={t.timezoneHint}>
              <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {(timeZones.includes(timezone) ? timeZones : [timezone, ...timeZones]).map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>
          <Card title={t.whoSeesWhat} description={t.whoSeesWhatDescription}>
            <div>
              <Switch label={privacy.showName} checked={showName} onChange={(e) => setShowName(e.target.checked)} />
              <Switch label={privacy.showSex} checked={showSex} onChange={(e) => setShowSex(e.target.checked)} />
            </div>
          </Card>
          <IconAndSharingCard
            isEmoji={iconIsEmoji}
            onIsEmojiChange={setIconIsEmoji}
            emoji={iconEmoji}
            onEmojiChange={setIconEmoji}
            preview={lastValid.current}
            address={address}
          />
        </div>
      </div>

      <div className={styles.saveBar}>
        <Button variant="primary" type="submit" loading={saving}>
          {saving ? t.saving : t.save}
        </Button>
        <StatusMessage tone="success">{saved ? t.saved : null}</StatusMessage>
        <StatusMessage tone="danger">{message || problemsText(errors, pageLang)}</StatusMessage>
      </div>
    </form>
  );
}

interface IconAndSharingCardProps {
  isEmoji: boolean;
  onIsEmojiChange: (isEmoji: boolean) => void;
  emoji: string;
  onEmojiChange: (emoji: string) => void;
  /** The Site settings the previews draw. */
  preview: SiteSettings;
  address: string;
}

/** The Site icon, the loading baby or an emoji, above the previews of the page outside itself. */
function IconAndSharingCard({
  isEmoji,
  onIsEmojiChange,
  emoji,
  onEmojiChange,
  preview,
  address,
}: IconAndSharingCardProps) {
  const t = platformCopy[useLang()].settings;
  return (
    <Card title={t.iconAndSharing} description={t.iconAndSharingDescription}>
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
        {isEmoji ? <EmojiPicker label={t.siteIconEmojiLabel} value={emoji} onChange={onEmojiChange} /> : null}
      </div>
      <SitePreviews settings={preview} address={address} />
    </Card>
  );
}

interface MilestonesCardProps {
  milestones: MilestoneDraft[];
  onChange: (milestones: MilestoneDraft[]) => void;
  languages: Lang[];
  inlineError: (path: string) => string | undefined;
  errorsPerLanguage: (path: string) => Partial<Record<Lang, string>>;
}

/** Every Milestone as a group: its emoji, its date, its label in each of the Site's Languages and its Place. */
function MilestonesCard({ milestones, onChange, languages, inlineError, errorsPerLanguage }: MilestonesCardProps) {
  const pageLang = useLang();
  const t = platformCopy[pageLang].settings;
  function add() {
    onChange([...milestones, { emoji: DEFAULT_MILESTONE_EMOJI, label: {}, date: '', placeText: '' }]);
  }
  function update(i: number, patch: Partial<MilestoneDraft>) {
    onChange(milestones.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function remove(i: number) {
    onChange(milestones.filter((_, idx) => idx !== i));
  }

  return (
    <Card title={t.milestones} description={t.milestonesDescription}>
      {milestones.length > 0 ? (
        <ol className={styles.milestones}>
          {milestones.map((m, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Milestones have no id; each row edits and removes the Milestone at its index.
            <li key={i} className={styles.milestoneItem}>
              <fieldset className={styles.milestone}>
                <legend className={styles.milestoneLegend}>
                  <VisuallyHidden>{t.milestone(i + 1)}</VisuallyHidden>
                </legend>
                <div className={styles.milestoneEmoji}>
                  <EmojiPicker
                    label={t.milestoneEmoji(i + 1)}
                    value={m.emoji}
                    onChange={(emoji) => update(i, { emoji })}
                  />
                </div>
                <Field
                  label={t.date}
                  labelHidden
                  error={inlineError(`milestones.${i}.date`)}
                  className={styles.milestoneDate}
                >
                  <Input type="date" value={m.date} onChange={(e) => update(i, { date: e.target.value })} />
                </Field>
                <Button icon="trash" labelHidden className={styles.milestoneRemove} onClick={() => remove(i)}>
                  {t.removeMilestone(i + 1)}
                </Button>
                <div className={styles.milestoneLabel}>
                  <PerLanguageField
                    label={t.label}
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
                        placeholder={platformCopy[lang].settings.labelPlaceholder}
                      />
                    )}
                  </PerLanguageField>
                </div>
                <PlaceField
                  text={m.placeText}
                  place={m.place}
                  onChange={(placeText, place) => update(i, { placeText, place })}
                  error={inlineError(`milestones.${i}.place`)}
                  className={styles.milestonePlace}
                />
              </fieldset>
            </li>
          ))}
        </ol>
      ) : null}
      <div>
        <Button variant="ghost" icon="plus" onClick={add}>
          {t.addMilestone}
        </Button>
      </div>
    </Card>
  );
}

/** The status message for the errors still showing: a pointer to the fields marked, then every other error in words. */
function problemsText(errors: SiteSettingsError[], lang: Lang): string | null {
  const elsewhere = errors.filter((error) => !isInlineError(error.path));
  const parts = [
    errors.length > elsewhere.length ? errorsCopy[lang].checkMarkedFields : null,
    elsewhere.length > 0 ? describeSiteSettingsErrors(elsewhere, lang) : null,
  ];
  return parts.filter(Boolean).join(' ') || null;
}

async function removeReplacedMedia(
  previous: { photo: ReturnType<typeof storedDraft>; video: ReturnType<typeof storedDraft> },
  next: typeof previous,
  remove: (key: string) => Promise<void>
) {
  for (const old of [previous.photo, previous.video]) {
    if (old && old.key !== next.photo?.key && old.key !== next.video?.key) {
      await remove(old.key);
    }
  }
}

async function prepareBirthMedia(
  settings: SiteSettingsInput,
  photo: MediaDraft,
  video: MediaDraft,
  upload: (draft: MediaDraft) => Promise<ReturnType<typeof storedDraft>>
) {
  // The Birth video is kept in the Waiting state too, ready for the day; the photo is a Birth detail.
  const next = { photo: settings.birth.born ? await upload(photo) : null, video: await upload(video) };
  if (settings.birth.born) {
    settings.birth.details.photo = next.photo;
  }
  settings.birthVideo = next.video;
  return next;
}
