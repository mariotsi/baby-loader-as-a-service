'use client';

import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { type Ref, type SubmitEvent, useEffect, useId, useRef, useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { Field } from '@/components/ui/Field';
import { FontPicker } from '@/components/ui/FontPicker';
import { Input } from '@/components/ui/Input';
import { LanguagesPicker } from '@/components/ui/LanguagesPicker';
import { PalettePicker } from '@/components/ui/PalettePicker';
import { PerLanguageField } from '@/components/ui/PerLanguageField';
import { PhoneStrip } from '@/components/ui/PhoneStrip';
import { SectionNav } from '@/components/ui/SectionNav';
import { Select } from '@/components/ui/Select';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { Switch } from '@/components/ui/Switch';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { birthNotificationMessages, syncBirthMilestone } from '@/lib/birthAnnouncement';
import { errorsCopy } from '@/lib/copy/errors';
import { platformCopy } from '@/lib/copy/platform';
import {
  describeSiteSettingsErrors,
  inlineErrorText,
  isInlineError,
  responseErrorText,
  routeErrorText,
} from '@/lib/errorText';
import type { Lang } from '@/lib/i18n';
import { takeWelcome } from '@/lib/newSiteWelcome';
import type { Milestone, SiteDTO } from '@/lib/site';
import {
  type BirthMedia,
  DEFAULT_MILESTONE_EMOJI,
  DEFAULT_SITE_ICON_EMOJI,
  type PageName,
  parseSiteSettings,
  type SiteSettings,
  type SiteSettingsError,
  type SiteSettingsInput,
} from '@/lib/siteSettings';
import { BirthDialog, type BirthDraft, type SaveOutcome } from './BirthDialog';
import { BirthMediaEditor, birthPhoto, birthVideoTitle, type MediaDraft, storedDraft } from './BirthMediaEditor';
import { EditorPreview } from './EditorPreview';
import { PlaceField } from './PlaceField';
import styles from './SiteEditor.module.css';
import { SiteIconField } from './SiteIconField';
import { SitePreviews } from './SitePreviews';
import { useLeaveGuard } from './useLeaveGuard';
import { usePhonePreview } from './usePhonePreview';
import { useStuck } from './useStuck';

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
export function SiteEditor({
  site,
  timeZones,
  address,
  mediaPreviewSlug,
  bornPlaceholderUrl,
}: {
  site: SiteDTO;
  timeZones: string[];
  address: string;
  mediaPreviewSlug?: string;
  /** What the Public page shows in place of a birth photo, which depends on the deployment. */
  bornPlaceholderUrl: string;
}) {
  const router = useRouter();
  const pageLang = useLang();
  const { settings: t, privacy } = platformCopy[pageLang];
  const [babyName, setBabyName] = useState(site.babyName);
  const [sex, setSex] = useState(site.sex);
  const [dueDate, setDueDate] = useState(site.dueDate?.slice(0, 10) ?? '');
  const details = site.birth.details;
  const [video, setVideo] = useState<MediaDraft>(site.birthVideo);
  const [savedMedia, setSavedMedia] = useState({ photo: birthPhoto(details), video: site.birthVideo });
  /** The Birth as last saved: only the Birth dialog changes it, and only by saving. */
  const [birth, setBirth] = useState<BirthDraft>(() => savedBirth(site));
  const [birthDialogOpen, setBirthDialogOpen] = useState(false);
  const birthButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
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
  /** How the birth notification went, after announcing the birth. */
  const [announced, setAnnounced] = useState<string | null>(null);
  /** The fields in error at the last failed save, checked again on every edit until they pass. */
  const [failedPaths, setFailedPaths] = useState<string[]>([]);
  /** Counts failed saves, so each one moves the focus to the first field in error. */
  const [failedSaves, setFailedSaves] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const preview = usePhonePreview();
  const { marker, stuck } = useStuck();
  /** Whether the Owner just created this Site. */
  const [welcome, setWelcome] = useState(false);
  const sectionIds = {
    baby: useId(),
    video: useId(),
    milestones: useId(),
    appearance: useId(),
    who: useId(),
    icon: useId(),
  };

  useEffect(() => {
    setWelcome(takeWelcome(site.slug));
  }, [site.slug]);

  useEffect(() => {
    if (failedSaves > 0) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [failedSaves]);

  /** The Milestones with `b` as the Birth: the Birth milestone follows the announcement (see syncBirthMilestone). */
  function milestonesWith(b: BirthDraft): MilestoneDraft[] {
    return syncBirthMilestone(
      milestones,
      { wasBorn: birth.born, born: b.born, date: b.datetime.slice(0, 10), languages, sex },
      (m) => ({ ...m, placeText: '' })
    );
  }

  function currentSettings(b: BirthDraft = birth): SiteSettingsInput {
    return {
      babyName,
      sex,
      dueDate: dueDate || null,
      birth: birthSettings(b),
      milestones: milestonesWith(b).map(({ placeText: _, ...m }) => ({ ...m, label: writtenTexts(m.label) })),
      languages,
      timezone,
      theme: { palette, font },
      // Announcing the birth shows the name and the sex to everyone, so the Privacy settings say so too.
      privacy: b.born && !birth.born ? { showName: true, showSex: true } : { showName, showSex },
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

  const { dirty, markSaved } = useUnsavedChanges(draftState(currentSettings(), milestones, video));
  const leaving = useLeaveGuard(dirty);

  /** Everything that stops a save: the Site settings rules, then Places typed and never picked. */
  function problems(b: BirthDraft = birth): SiteSettingsError[] {
    const checked = parseSiteSettings(currentSettings(b));
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
    setAnnounced(null);
    const found = problems();
    if (found.length > 0) {
      fail(found);
      return;
    }
    setFailedPaths([]);
    const outcome = await persist(birth);
    if (!outcome.ok) {
      setMessage(outcome.message);
      if (outcome.errors.length > 0) {
        fail(outcome.errors);
      }
    }
  }

  /** Saves the Birth from the dialog with everything else on the page, then closes the dialog. */
  async function saveBirth(next: BirthDraft): Promise<SaveOutcome> {
    setMessage(null);
    setSaved(false);
    setAnnounced(null);
    const announcing = !birth.born && next.born;
    const nextMilestones = milestonesWith(next);
    const outcome = await persist(next);
    if (outcome.ok) {
      setMilestones(nextMilestones);
      setFailedPaths([]);
      closeBirthDialog();
      if (announcing) {
        setShowName(true);
        setShowSex(true);
      }
      markSaved();
      if (announcing) {
        await sendBirthNotification(next);
      }
    }
    return outcome;
  }

  /** Tells every Subscription the baby is born, in each of the Site's Languages: "È nata Sofia!" and the Birth message, or an invitation to the page. */
  async function sendBirthNotification(next: BirthDraft) {
    const messages = birthNotificationMessages({ babyName, sex, languages }, next.message);
    const res = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: site.slug, messages }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok) {
      setAnnounced(t.announced(data.sent, data.total));
    } else {
      setMessage(`${t.notificationFailed} ${responseErrorText(data, pageLang)}`);
    }
  }

  function closeBirthDialog() {
    setBirthDialogOpen(false);
    returnFocus.current = true;
  }

  // Back on the button that opened the dialog, which saving may have swapped for another.
  useEffect(() => {
    if (!birthDialogOpen && returnFocus.current) {
      returnFocus.current = false;
      birthButton.current?.focus();
    }
  });

  /** Uploads the new media, saves the Site settings with `b` as the Birth, and removes the media they replaced. */
  async function persist(b: BirthDraft): Promise<SaveOutcome> {
    const settings = currentSettings(b);
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
      const next = await prepareBirthMedia(settings, b.photo, video, upload);
      const res = await fetch(`/api/sites/${site.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return data?.errors
          ? { ok: false, errors: data.errors, message: null }
          : { ok: false, errors: [], message: routeErrorText(data?.error, pageLang) };
      }
      committed = true;
      setBirth({ ...b, photo: next.photo });
      setVideo(next.video);
      setSavedMedia(next);
      setSaved(true);
      markSaved();
      router.refresh();
      await removeReplacedMedia(savedMedia, next, remove).catch(() => {});
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        errors: [],
        message: error instanceof Error ? error.message : routeErrorText(undefined, pageLang),
      };
    } finally {
      if (!committed) {
        await Promise.allSettled(uploaded.map((media) => remove(media.key)));
      }
      setSaving(false);
    }
  }

  return (
    <>
      <StatusMessage tone="success">{welcome ? t.welcome(address.replace(/^https?:\/\//, '')) : null}</StatusMessage>
      <div className={styles.editor}>
        <PhoneStrip
          showLabel={t.previewShow}
          hideLabel={t.previewHide}
          open={preview.open}
          onToggle={preview.toggle}
          controls={preview.id}
          joined={stuck}
        >
          {site.babyName || site.slug}
        </PhoneStrip>
        <div className={styles.main} inert={preview.open}>
          <div ref={marker} />
          <SectionNav
            className={menuClass(stuck)}
            label={t.sections}
            sections={[
              { id: sectionIds.baby, label: t.babyDetails },
              { id: sectionIds.appearance, label: t.appearance },
              { id: sectionIds.icon, label: t.iconAndSharing },
              { id: sectionIds.video, label: birthVideoTitle(pageLang) },
              { id: sectionIds.milestones, label: t.milestones },
              { id: sectionIds.who, label: t.whoSeesWhat },
            ]}
          />
          <form ref={formRef} onSubmit={save} className={styles.form} noValidate>
            <div id={sectionIds.baby} className={styles.section}>
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
                <BirthStatus birth={birth} sex={sex} buttonRef={birthButton} onOpen={() => setBirthDialogOpen(true)} />
              </Card>
            </div>

            <div id={sectionIds.appearance} className={styles.section}>
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
            </div>

            <div id={sectionIds.icon} className={styles.section}>
              <IconAndSharingCard
                isEmoji={iconIsEmoji}
                onIsEmojiChange={setIconIsEmoji}
                emoji={iconEmoji}
                onEmojiChange={setIconEmoji}
                preview={lastValid.current}
                address={address}
              />
            </div>

            <div id={sectionIds.video} className={styles.section}>
              <BirthMediaEditor previewSlug={mediaPreviewSlug} only="video" video={video} onVideo={setVideo} />
            </div>

            <div id={sectionIds.milestones} className={styles.section}>
              <MilestonesCard
                milestones={milestones}
                onChange={setMilestones}
                languages={languages}
                inlineError={inlineError}
                errorsPerLanguage={errorsPerLanguage}
              />
            </div>

            <div id={sectionIds.who} className={styles.section}>
              <Card title={t.whoSeesWhat} description={t.whoSeesWhatDescription}>
                <div>
                  <Switch label={privacy.showName} checked={showName} onChange={(e) => setShowName(e.target.checked)} />
                  <Switch label={privacy.showSex} checked={showSex} onChange={(e) => setShowSex(e.target.checked)} />
                </div>
              </Card>
            </div>

            <SaveBar
              saving={saving}
              dirty={dirty}
              done={saved ? (announced ?? t.saved) : null}
              problem={message || problemsText(errors, pageLang)}
            />
          </form>
        </div>
        <EditorPreview
          settings={lastValid.current}
          slug={site.slug}
          photo={birth.photo}
          video={video}
          mediaPreviewSlug={mediaPreviewSlug}
          bornPlaceholderUrl={bornPlaceholderUrl}
          open={preview.open}
          id={preview.id}
        />
      </div>
      <ConfirmDialog
        open={leaving.target !== null}
        title={t.leaveTitle}
        description={t.leaveDescription}
        confirmLabel={t.leave}
        dismissLabel={t.keepEditing}
        onConfirm={leaving.leave}
        onClose={leaving.stay}
      />
      {birthDialogOpen ? (
        <BirthDialog
          initial={birth.born ? birth : { ...birth, datetime: birth.datetime || format(new Date(), LOCAL_DATETIME) }}
          babyName={babyName}
          sex={sex}
          onBabyName={setBabyName}
          onSex={setSex}
          hidden={{ name: !showName, sex: !showSex }}
          languages={languages}
          previewSlug={mediaPreviewSlug}
          check={problems}
          settingsWith={(b) => {
            const checked = parseSiteSettings(currentSettings(b));
            return checked.ok ? checked.value : null;
          }}
          slug={site.slug}
          address={address}
          video={video}
          bornPlaceholderUrl={bornPlaceholderUrl}
          onSave={saveBirth}
          onClose={closeBirthDialog}
        />
      ) : null}
    </>
  );
}

function menuClass(stuck: boolean) {
  return stuck ? `${styles.menu} ${styles.menuStuck}` : styles.menu;
}

/** What a save would change, Places being typed and a picked video included. */
function draftState(settings: SiteSettingsInput, milestones: MilestoneDraft[], video: MediaDraft): string {
  return JSON.stringify([
    settings,
    milestones.map((m) => m.placeText),
    video instanceof File ? [video.name, video.size, video.lastModified] : null,
  ]);
}

/** Whether `draft` differs from what was last saved. `markSaved` makes the draft of the next render the saved one. */
function useUnsavedChanges(draft: string) {
  const [savedDraft, setSavedDraft] = useState(draft);
  const [justSaved, setJustSaved] = useState(false);
  if (justSaved) {
    setJustSaved(false);
    setSavedDraft(draft);
  }
  return { dirty: draft !== savedDraft, markSaved: () => setJustSaved(true) };
}

interface SaveBarProps {
  saving: boolean;
  dirty: boolean;
  /** How the last save went, shown until the next edit. */
  done: string | null;
  problem: string | null;
}

/** Save, with what is unsaved, saved or wrong beside it, against the bottom edge while the form scrolls. */
function SaveBar({ saving, dirty, done, problem }: SaveBarProps) {
  const t = platformCopy[useLang()].settings;
  return (
    <div className={styles.saveBar}>
      <Button variant="primary" type="submit" loading={saving}>
        {saving ? t.saving : t.save}
      </Button>
      <StatusMessage tone="info">{dirty ? t.unsaved : null}</StatusMessage>
      <StatusMessage tone="success">{done && !dirty ? done : null}</StatusMessage>
      <StatusMessage tone="danger">{problem}</StatusMessage>
    </div>
  );
}

/** The Birth as the Site settings hold it, from the fields as typed. */
function birthSettings(b: BirthDraft): SiteSettingsInput['birth'] {
  if (!b.born) {
    return { born: false, details: null };
  }
  return {
    born: true,
    details: {
      datetime: b.datetime ? parseISO(b.datetime).toISOString() : '',
      weightGrams: b.weight ? Number(b.weight) : null,
      lengthCm: b.lengthCm ? Number(b.lengthCm) : null,
      message: writtenTexts(b.message),
      photo: storedDraft(b.photo),
    },
  };
}

function savedBirth(site: SiteDTO): BirthDraft {
  const details = site.birth.details;
  return {
    born: site.birth.born,
    datetime: details ? format(parseISO(details.datetime), LOCAL_DATETIME) : '',
    weight: details?.weightGrams?.toString() ?? '',
    lengthCm: details?.lengthCm?.toString() ?? '',
    message: details?.message ?? {},
    photo: birthPhoto(details),
  };
}

interface BirthStatusProps {
  birth: BirthDraft;
  sex: SiteSettingsInput['sex'];
  buttonRef: Ref<HTMLButtonElement>;
  onOpen: () => void;
}

/** Where the Birth stands, waiting or announced, and the button that opens the Birth details. */
function BirthStatus({ birth, sex, buttonRef, onOpen }: BirthStatusProps) {
  const pageLang = useLang();
  const t = platformCopy[pageLang].settings;
  if (!birth.born) {
    return (
      <div className={styles.birth}>
        <p className={styles.birthSummary}>{t.waitingForBirth}</p>
        <Button ref={buttonRef} icon="megaphone" onClick={onOpen}>
          {t.announceBirth}
        </Button>
      </div>
    );
  }
  const when = new Intl.DateTimeFormat(pageLang, { dateStyle: 'long', timeStyle: 'short' }).format(
    parseISO(birth.datetime)
  );
  const stats = [birth.weight ? `${birth.weight} g` : null, birth.lengthCm ? `${birth.lengthCm} cm` : null].filter(
    Boolean
  );
  return (
    <div className={styles.birth}>
      <div>
        <p className={styles.birthSummary}>
          <strong>{t.bornOn(when, sex)}</strong>
        </p>
        {stats.length > 0 ? <p className={styles.birthStats}>{stats.join(' · ')}</p> : null}
      </div>
      <Button ref={buttonRef} onClick={onOpen}>
        {t.editBirth}
      </Button>
    </div>
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
      <SiteIconField isEmoji={isEmoji} onIsEmojiChange={onIsEmojiChange} emoji={emoji} onEmojiChange={onEmojiChange} />
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
