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
import { birthDay, instantIn, localIn } from '@/lib/birthAnnouncement';
import type { MediaUrl } from '@/lib/birthMedia';
import { errorsCopy } from '@/lib/copy/errors';
import { type PlatformCopy, platformCopy } from '@/lib/copy/platform';
import { describeSiteSettingsErrors, inlineErrorText, isInlineError, routeErrorText } from '@/lib/errorText';
import type { Lang } from '@/lib/i18n';
import { takeWelcome } from '@/lib/newSiteWelcome';
import type { DeliveryResult } from '@/lib/notificationDelivery';
import type { SiteDTO } from '@/lib/site';
import {
  type BirthDraft,
  birthDraftOf,
  birthSettings,
  birthWrite,
  type DraftBirth,
  draftOfSite,
  draftProblems,
  hasBirthMilestone,
  lastValidSettings,
  type MediaDraft,
  type MilestoneDraft,
  type SiteDraft,
  sameDraft,
  settingsOfDraft,
  withSavedBirthMilestone,
} from '@/lib/siteDraft';
import {
  type BirthMedia,
  DEFAULT_MILESTONE_EMOJI,
  parseBirthPreview,
  parseSiteSettings,
  type SiteSettings,
  type SiteSettingsError,
  type SiteSettingsInput,
  siteSettingsOf,
} from '@/lib/siteSettings';
import { BirthDialog, type SaveFailure, type SaveOutcome } from './BirthDialog';
import { BirthMediaEditor, birthVideoTitle } from './BirthMediaEditor';
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
  bornPlaceholderUrl: MediaUrl;
}) {
  const router = useRouter();
  const pageLang = useLang();
  const { settings: t } = platformCopy[pageLang];
  /** Every field on the page but the Birth and the Birth video, as typed. */
  const [draft, setDraft] = useState<SiteDraft>(() => draftOfSite(site));
  const [video, setVideo] = useState<MediaDraft>(site.birthVideo);
  /** The Site as last saved: where the Birth dialog's saves start from, and the `updatedAt` every save sends back. */
  const [stored, setStored] = useState<SiteDTO>(site);
  /** The Birth as last saved: only the Birth dialog changes it, and only by saving. */
  const [birth, setBirth] = useState<BirthDraft>(() => birthDraftOf(site));
  const [birthDialogOpen, setBirthDialogOpen] = useState(false);
  const birthButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
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

  function update(patch: Partial<SiteDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  /** The Birth and the Birth video beside the draft, with `b` as the Birth, its time read in the Site's saved Timezone. */
  function draftBirth(b: BirthDraft = birth): DraftBirth {
    return { birth: birthSettings(b, stored.timezone), birthVideo: video };
  }

  function currentSettings(): SiteSettingsInput {
    return settingsOfDraft(draft, draftBirth());
  }

  /** The Site as saving `b` from the Birth dialog would leave it. */
  function afterBirthSave(b: BirthDraft): SiteSettings {
    return birthWrite(siteSettingsOf(stored), b, { babyName: draft.babyName, sex: draft.sex, birthVideo: video });
  }

  /** The previews draw the Site settings as they stand, or as they last stood valid while a field is half filled. */
  const lastValid = useRef<SiteSettings>(site);
  lastValid.current = lastValidSettings(currentSettings(), lastValid.current);

  /** The page as last saved: the unsaved changes are where the draft differs from it. */
  const [baseline, setBaseline] = useState(() => ({ draft, birth: draftBirth() }));
  const dirty = !sameDraft(draft, draftBirth(), baseline.draft, baseline.birth);
  // A stale page can't save what it holds, and Reload says so: guarding it would ask again before reloading.
  const leaving = useLeaveGuard(dirty && !stale);

  /** Everything that stops a save: the Site settings rules, then Places typed and never picked. */
  function problems(): SiteSettingsError[] {
    return draftProblems(draft, draftBirth());
  }

  /** Everything that stops the Birth dialog saving `b`. */
  function birthProblems(b: BirthDraft): SiteSettingsError[] {
    const checked = parseSiteSettings(afterBirthSave(b));
    return checked.ok ? [] : checked.errors;
  }

  // Only the fields that failed the last save are checked while the Owner fixes them: nothing new turns red mid-edit.
  const errors = failedPaths.length > 0 ? problems().filter((error) => failedPaths.includes(error.path)) : [];

  function inlineError(path: string): string | undefined {
    const error = errors.find((e) => e.path === path);
    return error ? inlineErrorText(error, draft.languages, pageLang) : undefined;
  }

  function errorsPerLanguage(path: string): Partial<Record<Lang, string>> {
    return Object.fromEntries(draft.languages.map((lang) => [lang, inlineError(`${path}.${lang}`)]));
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
      const savedDraft = birthDraftOf(written);
      setStored(written);
      setBirth(savedDraft);
      setVideo(written.birthVideo);
      setBaseline({
        draft,
        birth: { birth: birthSettings(savedDraft, written.timezone), birthVideo: written.birthVideo },
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
              babyName: draft.babyName,
              sex: draft.sex,
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
      const savedDraft = birthDraftOf(written);
      setStored(written);
      setBirth(savedDraft);
      setVideo(written.birthVideo);
      update({
        milestones: withSavedBirthMilestone(
          draft.milestones,
          written.milestones,
          hasBirthMilestone(baseline.draft.milestones)
        ),
      });
      setBaseline({
        draft: {
          ...baseline.draft,
          babyName: written.babyName,
          sex: written.sex,
          milestones: withSavedBirthMilestone(baseline.draft.milestones, written.milestones, false),
        },
        birth: { birth: birthSettings(savedDraft, written.timezone), birthVideo: written.birthVideo },
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
   * Runs a save that may upload media first. A failed upload stops the save.
   * Media uploaded for a save that did not go through is left for the server,
   * which sweeps a Site's unused files on its next upload.
   */
  async function withUploads(
    run: (upload: (draft: MediaDraft) => Promise<BirthMedia | null>) => Promise<SaveOutcome>
  ): Promise<SaveOutcome> {
    setSaving(true);
    setStale(false);
    async function upload(media: MediaDraft): Promise<BirthMedia | null> {
      if (!(media instanceof File)) {
        return media;
      }
      const body = new FormData();
      body.set('file', media);
      const response = await fetch(`/api/sites/${site.slug}/media`, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(routeErrorText(data.error, pageLang));
      }
      return { ...data.media, name: media.name, type: media.type, size: media.size };
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
      setStale(outcome.stale === true);
    }
    setSaving(false);
    return outcome;
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
                  <Input
                    value={draft.babyName}
                    onChange={(e) => update({ babyName: e.target.value })}
                    autoComplete="off"
                  />
                </Field>
                <Field label={t.sex}>
                  <Select value={draft.sex} onChange={(e) => update({ sex: e.target.value as SiteDraft['sex'] })}>
                    <option value="unknown">{t.sexUnknown}</option>
                    <option value="female">{t.sexFemale}</option>
                    <option value="male">{t.sexMale}</option>
                  </Select>
                </Field>
                <Field label={t.dueDate} optional>
                  <Input type="date" value={draft.dueDate} onChange={(e) => update({ dueDate: e.target.value })} />
                </Field>
                <BirthStatus
                  birth={birth}
                  sex={draft.sex}
                  timezone={stored.timezone}
                  buttonRef={birthButton}
                  onOpen={() => setBirthDialogOpen(true)}
                />
              </Card>
            </div>

            <div id={sectionIds.appearance} className={styles.section}>
              <Card title={t.appearance} description={t.appearanceDescription}>
                <PalettePicker value={draft.palette} onChange={(palette) => update({ palette })} />
                <FontPicker
                  value={draft.font}
                  onChange={(font) => update({ font })}
                  sample={draft.babyName.trim() || 'Aa'}
                />
                <LanguagesPicker value={draft.languages} onChange={(languages) => update({ languages })} />
                <PerLanguageField
                  label={t.pageName}
                  hint={t.pageNameHint}
                  languages={draft.languages}
                  value={draft.pageName}
                  onChange={(lang, text) => update({ pageName: { ...draft.pageName, [lang]: text } })}
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
                  <Select value={draft.timezone} onChange={(e) => update({ timezone: e.target.value })}>
                    {(timeZones.includes(draft.timezone) ? timeZones : [draft.timezone, ...timeZones]).map((zone) => (
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
                isEmoji={draft.iconIsEmoji}
                onIsEmojiChange={(iconIsEmoji) => update({ iconIsEmoji })}
                emoji={draft.iconEmoji}
                onEmojiChange={(iconEmoji) => update({ iconEmoji })}
                preview={lastValid.current}
                address={address}
              />
            </div>

            <div id={sectionIds.video} className={styles.section}>
              <BirthMediaEditor previewSlug={mediaPreviewSlug} only="video" video={video} onVideo={setVideo} />
            </div>

            <div id={sectionIds.milestones} className={styles.section}>
              <MilestonesCard
                milestones={draft.milestones}
                birthDate={birth.born ? birthDay(instantIn(birth.datetime, stored.timezone), draft.timezone) : null}
                onChangeBirthDay={() => setBirthDialogOpen(true)}
                onChange={(milestones) => update({ milestones })}
                languages={draft.languages}
                inlineError={inlineError}
                errorsPerLanguage={errorsPerLanguage}
              />
            </div>

            <div id={sectionIds.who} className={styles.section}>
              <Card title={t.whoSeesWhat} description={t.whoSeesWhatDescription}>
                <PrivacySwitches
                  born={birth.born}
                  babyName={draft.babyName}
                  sex={draft.sex}
                  showName={draft.showName}
                  showSex={draft.showSex}
                  onShowName={(showName) => update({ showName })}
                  onShowSex={(showSex) => update({ showSex })}
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
          babyName={draft.babyName}
          sex={draft.sex}
          onBabyName={(babyName) => update({ babyName })}
          onSex={(sex) => update({ sex })}
          hidden={{ name: !draft.showName, sex: !draft.showSex }}
          languages={draft.languages}
          previewSlug={mediaPreviewSlug}
          timezone={stored.timezone}
          check={birthProblems}
          settingsWith={(b) => parseBirthPreview(afterBirthSave(b))}
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
