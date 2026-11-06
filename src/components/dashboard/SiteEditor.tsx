'use client';

import { parseISO } from 'date-fns';
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
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { birthDay, instantIn, localIn, settledBirthMilestones, withBirth } from '@/lib/birthAnnouncement';
import { errorsCopy } from '@/lib/copy/errors';
import { type PlatformCopy, platformCopy } from '@/lib/copy/platform';
import { describeSiteSettingsErrors, inlineErrorText, isInlineError, routeErrorText } from '@/lib/errorText';
import type { Lang } from '@/lib/i18n';
import { takeWelcome } from '@/lib/newSiteWelcome';
import type { DeliveryResult } from '@/lib/notificationDelivery';
import type { Milestone, SiteDTO } from '@/lib/site';
import {
  type BirthDetails,
  type BirthMedia,
  DEFAULT_MILESTONE_EMOJI,
  DEFAULT_SITE_ICON_EMOJI,
  type PageName,
  parseBirthPreview,
  parseSiteSettings,
  type SiteSettings,
  type SiteSettingsError,
  type SiteSettingsInput,
  siteSettingsOf,
} from '@/lib/siteSettings';
import { BirthDialog, type BirthDraft, type SaveFailure, type SaveOutcome } from './BirthDialog';
import { BirthMediaEditor, birthPhoto, birthVideoTitle, type MediaDraft, storedDraft } from './BirthMediaEditor';
import { EditorPreview } from './EditorPreview';
import { PlaceField } from './PlaceField';
import { PrivacySwitches } from './PrivacySwitches';
import styles from './SiteEditor.module.css';
import { SiteIconField } from './SiteIconField';
import { SitePreviews } from './SitePreviews';
import { useLeaveGuard } from './useLeaveGuard';
import { usePhonePreview } from './usePhonePreview';
import { useStuck } from './useStuck';

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

/** Every field on the page but the Milestones, as a save would send them, the Birth included. */
type DraftFields = Omit<SiteSettingsInput, 'milestones'>;

/** What the page holds, as last saved or as edited since: the unsaved changes are where the two differ. */
interface Draft {
  fields: DraftFields;
  milestones: MilestoneDraft[];
  video: MediaDraft;
}

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
  const { settings: t } = platformCopy[pageLang];
  const [babyName, setBabyName] = useState(site.babyName);
  const [sex, setSex] = useState(site.sex);
  const [dueDate, setDueDate] = useState(site.dueDate?.slice(0, 10) ?? '');
  const [video, setVideo] = useState<MediaDraft>(site.birthVideo);
  /** The Site as last saved: where the Birth dialog's saves start from, and the `updatedAt` every save sends back. */
  const [stored, setStored] = useState<SiteDTO>(site);
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
  const [announced, setAnnounced] = useState<Announced | null>(null);
  /** Whether the last save found the Site changed in another tab, which only a reload brings here. */
  const [stale, setStale] = useState(false);
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

  /** The fields as they stand, with `b` as the Birth, its time read in the Site's saved Timezone. */
  function fieldsNow(b: BirthDraft = birth): DraftFields {
    return {
      babyName,
      sex,
      dueDate: dueDate || null,
      birth: birthSettings(b, stored.timezone),
      languages,
      timezone,
      theme: { palette, font },
      privacy: { showName, showSex },
      pageName: writtenTexts(pageName),
      icon: iconIsEmoji ? iconEmoji : null,
      birthVideo: storedDraft(video),
    };
  }

  function currentSettings(): SiteSettingsInput {
    return settingsOfDraft(fieldsNow(), milestones);
  }

  /** The Site as saving `b` from the Birth dialog would leave it: as last saved, with `b`, the name, the Sex and the Birth video. */
  function birthWrite(b: BirthDraft): SiteSettings {
    const before = siteSettingsOf(stored);
    if (!b.born) {
      return withBirth(before, null);
    }
    const { details } = birthSettings(b, stored.timezone) as { details: BirthDetails };
    return withBirth(before, { babyName, sex, details, birthVideo: storedDraft(video) });
  }

  /** The previews draw the Site settings as they stand, or as they last stood valid while a field is half filled. */
  const lastValid = useRef<SiteSettings>(site);
  const checkedNow = parseSiteSettings(currentSettings());
  if (checkedNow.ok) {
    lastValid.current = checkedNow.value;
  }

  const [baseline, setBaseline] = useState<Draft>(() => ({ fields: fieldsNow(), milestones, video }));
  const dirty = draftState({ fields: fieldsNow(), milestones, video }) !== draftState(baseline);
  // A stale page can't save what it holds, and Reload says so: guarding it would ask again before reloading.
  const leaving = useLeaveGuard(dirty && !stale);

  /** Everything that stops a save: the Site settings rules, then Places typed and never picked. */
  function problems(): SiteSettingsError[] {
    const checked = parseSiteSettings(currentSettings());
    return [...(checked.ok ? [] : checked.errors), ...unpickedPlaces(milestones)];
  }

  /** Everything that stops the Birth dialog saving `b`. */
  function birthProblems(b: BirthDraft): SiteSettingsError[] {
    const checked = parseSiteSettings(birthWrite(b));
    return checked.ok ? [] : checked.errors;
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
    const outcome = await saveSettings();
    if (!outcome.ok) {
      setMessage(outcome.message);
      if (outcome.errors.length > 0) {
        fail(outcome.errors);
      }
    }
  }

  /** Uploads a new Birth video and saves every Site setting but the Birth. */
  function saveSettings(): Promise<SaveOutcome> {
    return withUploads(async (upload) => {
      const { birth: _, ...settings } = { ...currentSettings(), birthVideo: await upload(video) };
      const result = await sent(
        fetch(`/api/sites/${site.slug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updatedAt: stored.updatedAt, settings }),
        })
      );
      if (!result.ok) {
        return result;
      }
      const written = result.site;
      const savedDraft = savedBirth(written);
      setStored(written);
      setBirth(savedDraft);
      setVideo(written.birthVideo);
      setBaseline({
        fields: { ...fieldsNow(), birth: birthSettings(savedDraft, written.timezone), birthVideo: written.birthVideo },
        milestones,
        video: written.birthVideo,
      });
      setSaved(true);
      router.refresh();
      return { ok: true };
    });
  }

  /**
   * Saves the Birth from the dialog, with the name, the Sex and the Birth
   * video, then closes the dialog. The page's other changes stay as they
   * are, still unsaved.
   */
  function saveBirth(next: BirthDraft): Promise<SaveOutcome> {
    setMessage(null);
    setSaved(false);
    setAnnounced(null);
    return withUploads(async (upload) => {
      const request = next.born
        ? {
            method: 'PUT',
            body: {
              updatedAt: stored.updatedAt,
              babyName,
              sex,
              details: { ...birthSettings(next, stored.timezone).details, photo: await upload(next.photo) },
              birthVideo: await upload(video),
            },
          }
        : { method: 'DELETE', body: { updatedAt: stored.updatedAt } };
      const result = await sent(
        fetch(`/api/sites/${site.slug}/birth`, {
          method: request.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body),
        })
      );
      if (!result.ok) {
        return result;
      }
      const written = result.site;
      const savedDraft = savedBirth(written);
      setStored(written);
      setBirth(savedDraft);
      setVideo(written.birthVideo);
      setMilestones(withSavedBirthMilestone(milestones, written.milestones, hasBirthMilestone(baseline.milestones)));
      setBaseline({
        fields: {
          ...baseline.fields,
          babyName: written.babyName,
          sex: written.sex,
          birth: birthSettings(savedDraft, written.timezone),
          birthVideo: written.birthVideo,
        },
        milestones: withSavedBirthMilestone(baseline.milestones, written.milestones, false),
        video: written.birthVideo,
      });
      setFailedPaths([]);
      closeBirthDialog();
      router.refresh();
      if (result.notification === 'failed') {
        setMessage(t.notificationFailed);
      } else if (result.notification) {
        const { sent: reached, total } = result.notification;
        setAnnounced({ text: t.announced(reached, total), everyone: reached === total });
      } else {
        setSaved(true);
      }
      return { ok: true };
    });
  }

  /**
   * Runs a save that may upload media first. A failed upload stops the save,
   * and the media uploaded for a save that did not go through is removed.
   */
  async function withUploads(
    run: (upload: (draft: MediaDraft) => Promise<BirthMedia | null>) => Promise<SaveOutcome>
  ): Promise<SaveOutcome> {
    setSaving(true);
    setStale(false);
    const uploaded: string[] = [];
    async function upload(draft: MediaDraft): Promise<BirthMedia | null> {
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
      uploaded.push(data.media.key);
      return { ...data.media, name: draft.name, type: draft.type, size: draft.size };
    }
    let outcome: SaveOutcome;
    try {
      outcome = await run(upload);
    } catch (error) {
      outcome = {
        ok: false,
        errors: [],
        message: error instanceof Error ? error.message : routeErrorText(undefined, pageLang),
      };
    }
    if (!outcome.ok) {
      await Promise.allSettled(uploaded.map((key) => removeMedia(key)));
      setStale(outcome.stale === true);
    }
    setSaving(false);
    return outcome;
  }

  async function removeMedia(key: string) {
    await fetch(`/api/sites/${site.slug}/media`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
  }

  /** What the Site settings and Birth routes answered: the saved Site, or what went wrong as the page shows it. */
  async function sent(request: Promise<Response>): Promise<Written | SaveFailure> {
    const res = await request.catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok) {
      return { ok: true, site: data.site, notification: data.notification };
    }
    if (res?.status === 409) {
      return { ok: false, errors: [], message: routeErrorText(data?.error, pageLang), stale: true };
    }
    return data?.errors
      ? { ok: false, errors: data.errors, message: null }
      : { ok: false, errors: [], message: routeErrorText(data?.error, pageLang) };
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
          <div ref={marker} className={styles.stickMarker} />
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
                <Field label={t.name} {...nameNote(birth, t)}>
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
                <BirthStatus
                  birth={birth}
                  sex={sex}
                  timezone={stored.timezone}
                  buttonRef={birthButton}
                  onOpen={() => setBirthDialogOpen(true)}
                />
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
                birthDate={birth.born ? birthDay(instantIn(birth.datetime, stored.timezone), timezone) : null}
                onChangeBirthDay={() => setBirthDialogOpen(true)}
                onChange={setMilestones}
                languages={languages}
                inlineError={inlineError}
                errorsPerLanguage={errorsPerLanguage}
              />
            </div>

            <div id={sectionIds.who} className={styles.section}>
              <Card title={t.whoSeesWhat} description={t.whoSeesWhatDescription}>
                <PrivacySwitches
                  born={birth.born}
                  babyName={babyName}
                  sex={sex}
                  showName={showName}
                  showSex={showSex}
                  onShowName={setShowName}
                  onShowSex={setShowSex}
                />
              </Card>
            </div>

            <SaveBar
              saving={saving}
              dirty={dirty}
              saved={saved}
              announced={announced}
              problem={message || problemsText(errors, pageLang)}
              stale={stale}
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
          initial={birth.born ? birth : { ...birth, datetime: birth.datetime || localIn(new Date(), stored.timezone) }}
          babyName={babyName}
          sex={sex}
          onBabyName={setBabyName}
          onSex={setSex}
          hidden={{ name: !showName, sex: !showSex }}
          languages={languages}
          previewSlug={mediaPreviewSlug}
          timezone={stored.timezone}
          check={birthProblems}
          settingsWith={(b) => parseBirthPreview(birthWrite(b))}
          slug={site.slug}
          address={address}
          video={video}
          onVideo={setVideo}
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
function draftState({ fields, milestones, video }: Draft): string {
  return JSON.stringify([
    settingsOfDraft(fields, milestones),
    milestones.map((m) => m.placeText),
    video instanceof File ? [video.name, video.size, video.lastModified] : null,
  ]);
}

/** The Site settings the page holds, with the Birth milestone on the day of birth as the server saves it. */
function settingsOfDraft(fields: DraftFields, milestones: MilestoneDraft[]): SiteSettingsInput {
  const settled = settledBirthMilestones(milestones, fields.birth as SiteSettings['birth'], fields.timezone);
  return { ...fields, milestones: settled.map(({ placeText: _, ...m }) => ({ ...m, label: writtenTexts(m.label) })) };
}

function hasBirthMilestone(milestones: Milestone[]): boolean {
  return milestones.some((m) => m.kind === 'birth');
}

/**
 * The editor's Milestones once the Birth is saved: the Birth milestone on the
 * day the server saved, with the Owner's unsaved label and emoji. One the
 * Owner removed and has not saved yet (`removedHere`) stays removed.
 */
function withSavedBirthMilestone(drafts: MilestoneDraft[], saved: Milestone[], removedHere: boolean): MilestoneDraft[] {
  const savedOne = saved.find((m) => m.kind === 'birth');
  if (!savedOne) {
    return drafts.filter((m) => m.kind !== 'birth');
  }
  if (hasBirthMilestone(drafts)) {
    return drafts.map((m) => (m.kind === 'birth' ? { ...m, date: savedOne.date } : m));
  }
  return removedHere ? drafts : [...drafts, { ...savedOne, placeText: savedOne.place?.address ?? '' }];
}

/** A save that went through: the Site as saved, and the Birth notification it sent, if any. */
type Written = { ok: true; site: SiteDTO; notification: DeliveryResult | 'failed' | null };

/** How the Birth notification went: `everyone` once it reached every subscriber. */
interface Announced {
  text: string;
  everyone: boolean;
}

interface SaveBarProps {
  saving: boolean;
  dirty: boolean;
  /** Whether the last save went through, said until the next edit. */
  saved: boolean;
  /** How the Birth notification went, said until the next save, whatever else is unsaved. */
  announced: Announced | null;
  problem: string | null;
  /** Whether the Site changed in another tab: the page offers to reload. */
  stale: boolean;
}

/** Save, with what is unsaved, saved or wrong beside it, against the bottom edge while the form scrolls. */
function SaveBar({ saving, dirty, saved, announced, problem, stale }: SaveBarProps) {
  const t = platformCopy[useLang()].settings;
  let success = saved && !dirty ? t.saved : null;
  if (announced?.everyone) {
    success = announced.text;
  }
  const info = [announced && !announced.everyone ? announced.text : null, dirty ? t.unsaved : null].filter(Boolean);
  return (
    <div className={styles.saveBar}>
      <Button variant="primary" type="submit" loading={saving}>
        {saving ? t.saving : t.save}
      </Button>
      <StatusMessage tone="info">{info.length > 0 ? info.join(' ') : null}</StatusMessage>
      <StatusMessage tone="success">{success}</StatusMessage>
      <StatusMessage tone="danger">{problem}</StatusMessage>
      {stale ? <Button onClick={() => window.location.reload()}>{t.reload}</Button> : null}
    </div>
  );
}

/** The Birth as the Site settings hold it, from the fields as typed: the time is the wall clock in `timezone`. */
function birthSettings(b: BirthDraft, timezone: string): SiteSettingsInput['birth'] {
  if (!b.born) {
    return { born: false, details: null };
  }
  return {
    born: true,
    details: {
      datetime: instantIn(b.datetime, timezone),
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
    datetime: details ? localIn(details.datetime, site.timezone) : '',
    weight: details?.weightGrams?.toString() ?? '',
    lengthCm: details?.lengthCm?.toString() ?? '',
    message: details?.message ?? {},
    photo: birthPhoto(details),
  };
}

/** The name is required from the birth's announcement on. */
function nameNote(birth: BirthDraft, t: PlatformCopy['settings']) {
  return birth.born ? {} : { optional: true, hint: t.nameHint };
}

interface BirthStatusProps {
  birth: BirthDraft;
  sex: SiteSettingsInput['sex'];
  /** The Site's saved Timezone, which the Birth's time is told in. */
  timezone: string;
  buttonRef: Ref<HTMLButtonElement>;
  onOpen: () => void;
}

/** Where the Birth stands, waiting or announced, and the button that opens the Birth details. */
function BirthStatus({ birth, sex, timezone, buttonRef, onOpen }: BirthStatusProps) {
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
  const when = new Intl.DateTimeFormat(pageLang, { dateStyle: 'long', timeStyle: 'short', timeZone: timezone }).format(
    parseISO(instantIn(birth.datetime, timezone))
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
  /** The day of birth in the Site's Timezone, which the Birth milestone always stands on; null while Waiting. */
  birthDate: string | null;
  /** Opens the Birth details, where the day of birth changes. */
  onChangeBirthDay: () => void;
  onChange: (milestones: MilestoneDraft[]) => void;
  languages: Lang[];
  inlineError: (path: string) => string | undefined;
  errorsPerLanguage: (path: string) => Partial<Record<Lang, string>>;
}

/** Every Milestone as a group: its emoji, its date, its label in each of the Site's Languages and its Place. */
function MilestonesCard({
  milestones,
  birthDate,
  onChangeBirthDay,
  onChange,
  languages,
  inlineError,
  errorsPerLanguage,
}: MilestonesCardProps) {
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
                {m.kind === 'birth' ? (
                  <Field
                    label={t.date}
                    labelHidden
                    hint={
                      <>
                        {t.birthMilestoneDate}{' '}
                        <Button variant="link" inline onClick={onChangeBirthDay}>
                          {t.changeBirthDay}
                        </Button>
                      </>
                    }
                    className={styles.milestoneDate}
                  >
                    <Input type="date" value={birthDate ?? m.date} readOnly />
                  </Field>
                ) : (
                  <Field
                    label={t.date}
                    labelHidden
                    error={inlineError(`milestones.${i}.date`)}
                    className={styles.milestoneDate}
                  >
                    <Input type="date" value={m.date} onChange={(e) => update(i, { date: e.target.value })} />
                  </Field>
                )}
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
