'use client';

import { type SubmitEvent, useEffect, useRef, useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field } from '@/components/ui/Field';
import { FullPageDialog } from '@/components/ui/FullPageDialog';
import { Input } from '@/components/ui/Input';
import { PerLanguageField } from '@/components/ui/PerLanguageField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { Textarea } from '@/components/ui/Textarea';
import { birthNotificationMessages } from '@/lib/birthAnnouncement';
import type { MediaUrl } from '@/lib/birthMedia';
import { errorsCopy } from '@/lib/copy/errors';
import { platformCopy } from '@/lib/copy/platform';
import {
  describeSiteSettingsErrors,
  type ErrorForm,
  type ErrorPlace,
  errorPlace,
  inlineErrorText,
} from '@/lib/errorText';
import { fallbackLang, type Lang } from '@/lib/i18n';
import { notificationContent, notificationIcon } from '@/lib/notificationContent';
import { siteShortName } from '@/lib/siteAppIdentity';
import type { BirthDraft, MediaDraft } from '@/lib/siteDraft';
import type { BirthDetails, SiteSettings, SiteSettingsError } from '@/lib/siteSettings';
import { BirthMediaEditor, useBirthMediaUrl } from './BirthMediaEditor';
import { NotificationPreviews } from './NotificationPreviews';
import { PublicPagePreview } from './PublicPagePreview';
import styles from './SiteEditor.module.css';

/** The Birth as the editor holds it: the fields as typed, and the photo picked but maybe not yet uploaded. */

/** Why a save did not go through: Site settings errors, from the browser or the server, or a message. `stale` when the Site changed in another tab. */
export type SaveFailure = { ok: false; errors: SiteSettingsError[]; message: string | null; stale?: boolean };

/** How a save went. */
export type SaveOutcome = { ok: true } | SaveFailure;

interface BirthDialogProps {
  /** The Birth as it was saved; announcing starts from it with the date and time filled in. */
  initial: BirthDraft;
  /** The page's own name and sex: the dialog asks for them before announcing when either is missing. */
  babyName: string;
  sex: SiteSettings['sex'];
  onBabyName: (name: string) => void;
  onSex: (sex: SiteSettings['sex']) => void;
  /** What the Privacy settings hide until now, which announcing shows to everyone. */
  hidden: { name: boolean; sex: boolean };
  languages: Lang[];
  /** The Site's saved Timezone, which the birth's time is on. */
  timezone: string;
  previewSlug?: string;
  /** Everything that would stop saving this Birth. */
  check: (birth: BirthDraft) => SiteSettingsError[];
  /** The Site settings the previews draw with this Birth, name and Sex given or not, or null while a field is half filled. */
  settingsWith: (birth: BirthDraft) => SiteSettings | null;
  slug: string;
  /** The Site's Address, where the notification comes from. */
  address: string;
  /** The Birth video, the same draft the page around the dialog edits. */
  video: MediaDraft;
  onVideo: (video: MediaDraft) => void;
  /** What the page shows in place of a birth photo. */
  bornPlaceholderUrl: MediaUrl;
  /** Saves this Birth with the name, the Sex and the Birth video; the page's other changes stay unsaved. */
  onSave: (birth: BirthDraft) => Promise<SaveOutcome>;
  onClose: () => void;
}

/**
 * The Birth details on a page of their own: announcing the birth, or changing
 * what was announced. Nothing changes until the Owner saves, and saving saves
 * the Birth with the name, the Sex and the Birth video, which the page around
 * the dialog shows too.
 */
export function BirthDialog({
  initial,
  babyName,
  sex,
  onBabyName,
  onSex,
  hidden,
  languages,
  timezone,
  previewSlug,
  check,
  settingsWith,
  slug,
  address,
  video,
  onVideo,
  bornPlaceholderUrl,
  onSave,
  onClose,
}: BirthDialogProps) {
  const pageLang = useLang();
  const t = platformCopy[pageLang].settings;
  const announcing = !initial.born;
  /** Asked once, when the dialog opens, so the fields stay while the Owner fills them in. */
  const [asksIdentity] = useState(announcing && (!babyName.trim() || sex === 'unknown'));
  const revealed = announcing ? revealedText(t, hidden) : null;
  const [draft, setDraft] = useState<BirthDraft>(() => ({ ...initial, born: true }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [failedPaths, setFailedPaths] = useState<string[]>([]);
  const [failedSaves, setFailedSaves] = useState(0);
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [confirmingAnnounce, setConfirmingAnnounce] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  /** The previews keep the last Site settings that were whole while a field is half filled. */
  const lastSettings = useRef<SiteSettings | null>(null);
  lastSettings.current = settingsWith(draft) ?? lastSettings.current;
  const photoUrl = useBirthMediaUrl(draft.photo, previewSlug, 'photo');
  const videoUrl = useBirthMediaUrl(video, previewSlug, 'video');

  useEffect(() => {
    if (failedSaves > 0) {
      contentRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [failedSaves]);

  const errors = failedPaths.length > 0 ? check(draft).filter((error) => failedPaths.includes(error.path)) : [];
  /** Where this dialog shows an error: under its field, in words, or on the page behind it. */
  const form: ErrorForm = { birthDialog: { asksIdentity } };

  function inlineError(path: string): string | undefined {
    const error = errors.find((e) => e.path === path);
    return error ? inlineErrorText(error, languages, pageLang) : undefined;
  }

  function update(patch: Partial<BirthDraft>) {
    setDraft({ ...draft, ...patch });
  }

  /** Marks what stops saving `birth`, and says whether anything does. */
  function blocked(birth: BirthDraft): boolean {
    const found = check(birth);
    if (found.length > 0) {
      setFailedPaths(found.map((error) => error.path));
      setFailedSaves((count) => count + 1);
      return true;
    }
    setFailedPaths([]);
    return false;
  }

  async function save(birth: BirthDraft) {
    setMessage(null);
    if (blocked(birth)) {
      return;
    }
    setSaving(true);
    const outcome = await onSave(birth);
    if (outcome.ok) {
      return;
    }
    setSaving(false);
    setConfirmingUndo(false);
    setConfirmingAnnounce(false);
    setMessage(outcome.message);
    setStale(outcome.stale === true);
    if (outcome.errors.length > 0) {
      setFailedPaths(outcome.errors.map((error) => error.path));
      setFailedSaves((count) => count + 1);
    }
  }

  // Announcing sends the notification at once, so it asks first: a slip of the finger cannot announce.
  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!announcing) {
      void save(draft);
    } else if (!blocked(draft)) {
      setMessage(null);
      setConfirmingAnnounce(true);
    }
  }

  const status = message || statusText(t, errors, form, pageLang);

  return (
    <FullPageDialog
      open
      title={announcing ? t.birthDialogTitle(babyName.trim(), sex) : t.birthEditTitle}
      description={announcing ? t.birthDialogDescription : t.birthEditDescription}
      closeLabel={t.closeBirthDialog}
      busy={saving}
      onClose={onClose}
      onSubmit={submit}
      width="wide"
      actions={
        <>
          <StatusMessage tone="danger">{status}</StatusMessage>
          {stale ? <Button onClick={() => window.location.reload()}>{t.reload}</Button> : null}
          <Button onClick={() => !saving && onClose()}>{t.cancel}</Button>
          <Button variant="primary" type="submit" icon={announcing ? 'megaphone' : undefined} loading={saving}>
            {submitLabel(t, announcing, saving)}
          </Button>
        </>
      }
    >
      <div className={styles.birthLayout}>
        <div ref={contentRef} className={styles.column}>
          {revealed ? (
            <div className={styles.birth}>
              <p className={styles.birthSummary}>{revealed}</p>
            </div>
          ) : null}
          {asksIdentity ? (
            <Card title={t.identityCard} description={t.identityCardDescription} headingLevel={3}>
              <Field label={t.name} error={inlineError('babyName')}>
                <Input value={babyName} onChange={(e) => onBabyName(e.target.value)} autoComplete="off" />
              </Field>
              <SegmentedControl
                legend={t.sex}
                options={[
                  { value: 'female', label: t.sexFemale },
                  { value: 'male', label: t.sexMale },
                ]}
                value={sex}
                onChange={onSex}
              />
            </Card>
          ) : null}
          <Card title={t.birthDetailsCard} headingLevel={3}>
            <Field
              label={t.birthDatetime}
              hint={t.birthDatetimeHint(timezone)}
              error={inlineError('birth.details.datetime')}
            >
              <Input
                type="datetime-local"
                value={draft.datetime}
                onChange={(e) => update({ datetime: e.target.value })}
              />
            </Field>
            <div className={styles.pair}>
              <Field label={t.weight} optional error={inlineError('birth.details.weightGrams')}>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={draft.weight}
                  onChange={(e) => update({ weight: e.target.value })}
                />
              </Field>
              <Field label={t.length} optional error={inlineError('birth.details.lengthCm')}>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={draft.lengthCm}
                  onChange={(e) => update({ lengthCm: e.target.value })}
                />
              </Field>
            </div>
            <PerLanguageField
              label={t.message}
              languages={languages}
              value={draft.message}
              onChange={(lang, text) => update({ message: { ...draft.message, [lang]: text } })}
              errors={Object.fromEntries(languages.map((lang) => [lang, inlineError(`birth.details.message.${lang}`)]))}
              optional
            >
              {({ lang, value, onChange }) => (
                <Textarea lang={lang} value={value} onChange={(e) => onChange(e.target.value)} />
              )}
            </PerLanguageField>
          </Card>
          <BirthMediaEditor
            only="photo"
            headingLevel={3}
            previewSlug={previewSlug}
            photo={draft.photo}
            onPhoto={(photo) => update({ photo })}
          />
          <BirthMediaEditor only="video" headingLevel={3} previewSlug={previewSlug} video={video} onVideo={onVideo} />
          {announcing ? null : (
            <div>
              <Button variant="ghost" icon="trash" onClick={() => setConfirmingUndo(true)}>
                {t.unannounce}
              </Button>
            </div>
          )}
        </div>
        {lastSettings.current ? (
          <BirthPreviews
            settings={lastSettings.current}
            announcing={announcing}
            message={draft.message}
            slug={slug}
            address={address}
            photoUrl={photoUrl}
            videoUrl={videoUrl}
            bornPlaceholderUrl={bornPlaceholderUrl}
          />
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmingAnnounce}
        title={t.announceConfirmTitle}
        description={t.announceConfirmDescription}
        confirmLabel={t.announceBirth}
        dismissLabel={t.keepEditing}
        busy={saving}
        onConfirm={() => void save(draft)}
        onClose={() => setConfirmingAnnounce(false)}
      />
      <ConfirmDialog
        open={confirmingUndo}
        title={t.unannounceTitle}
        description={t.unannounceDescription}
        confirmLabel={t.unannounce}
        dismissLabel={t.keepBirthDetails}
        busy={saving}
        onConfirm={() => void save({ ...draft, born: false })}
        onClose={() => setConfirmingUndo(false)}
      />
    </FullPageDialog>
  );
}

interface BirthPreviewsProps {
  settings: SiteSettings;
  announcing: boolean;
  message: BirthDetails['message'];
  slug: string;
  address: string;
  photoUrl: MediaUrl | undefined;
  videoUrl: MediaUrl | undefined;
  bornPlaceholderUrl: MediaUrl;
}

/**
 * Beside the fields: the birth notification while announcing, as each
 * Language's subscribers get it, and the page in its Born state on a phone.
 */
function BirthPreviews({
  settings,
  announcing,
  message,
  slug,
  address,
  photoUrl,
  videoUrl,
  bornPlaceholderUrl,
}: BirthPreviewsProps) {
  const pageLang = useLang();
  const t = platformCopy[pageLang];
  const { languages } = settings;
  const icon = notificationIcon(settings, address, photoUrl ?? null);
  return (
    <div className={styles.birthPreviews}>
      {announcing ? (
        <Card
          title={t.settings.previewNotification}
          description={languages.length > 1 ? t.send.previewNote : undefined}
          headingLevel={3}
        >
          <NotificationPreviews
            languages={languages}
            texts={Object.fromEntries(
              languages.map((lang) => [
                lang,
                notificationContent(settings, birthNotificationMessages(settings, message), lang, icon),
              ])
            )}
            siteName={Object.fromEntries(languages.map((lang) => [lang, siteShortName(settings, lang)]))}
            host={address.replace(/^https?:\/\//, '')}
            icon={icon}
          />
        </Card>
      ) : null}
      <PublicPagePreview
        settings={settings}
        slug={slug}
        lang={languages.includes(pageLang) ? pageLang : fallbackLang(languages)}
        caption={t.settings.previewPage}
        media={{ photo: photoUrl ?? null, video: videoUrl ?? null, placeholder: bornPlaceholderUrl }}
      />
    </div>
  );
}

function submitLabel(t: (typeof platformCopy)[Lang]['settings'], announcing: boolean, saving: boolean): string {
  if (announcing) {
    return saving ? t.announcing : t.announceBirth;
  }
  return saving ? t.saving : t.save;
}

/** The dialog's errors in words: its own that no field shows, those elsewhere on the page, and a pointer to the marked fields. */
function statusText(
  t: (typeof platformCopy)[Lang]['settings'],
  errors: SiteSettingsError[],
  form: ErrorForm,
  lang: Lang
): string | null {
  const at = (place: ErrorPlace) => errors.filter((error) => errorPlace(error.path, form) === place);
  const birthErrors = at('status');
  const elsewhere = at('elsewhere');
  return (
    [
      birthErrors.length > 0 ? describeSiteSettingsErrors(birthErrors, lang) : null,
      elsewhere.length > 0 ? `${t.fixElsewhere} ${describeSiteSettingsErrors(elsewhere, lang)}` : null,
      at('field').length > 0 ? errorsCopy[lang].checkMarkedFields : null,
    ]
      .filter(Boolean)
      .join(' ') || null
  );
}

/** What announcing shows that the Privacy settings hide until now, or null when they hide nothing. */
function revealedText(t: (typeof platformCopy)[Lang]['settings'], hidden: { name: boolean; sex: boolean }) {
  if (hidden.name && hidden.sex) {
    return t.revealsNameAndSex;
  }
  if (hidden.name || hidden.sex) {
    return hidden.name ? t.revealsName : t.revealsSex;
  }
  return null;
}
