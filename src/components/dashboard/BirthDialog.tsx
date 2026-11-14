'use client';

import { useRef, useState } from 'react';
import { get, type Resolver, type UseFormReturn, useForm, useWatch } from 'react-hook-form';
import { useStore } from 'zustand';
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
import { routeErrorText } from '@/lib/errorText';
import { fallbackLang, type Lang } from '@/lib/i18n';
import { notificationContent, notificationIcon } from '@/lib/notificationContent';
import type { Site } from '@/lib/site';
import { siteShortName } from '@/lib/siteAppIdentity';
import type { BirthDraft, MediaDraft } from '@/lib/siteDraft';
import {
  birthPreview,
  birthProblems,
  birthToEdit,
  type EditorValues,
  holding,
  type SiteEditing,
} from '@/lib/siteEditing';
import type { BirthDetails, SiteSettings } from '@/lib/siteSettings';
import { BirthMediaEditor, useBirthMediaUrl } from './BirthMediaEditor';
import { NotificationPreviews } from './NotificationPreviews';
import { PublicPagePreview } from './PublicPagePreview';
import styles from './SiteEditor.module.css';
import { errorSummary, markErrors, settingsErrors, useFocusFirstError, useRecheckErrors } from './settingsForm';

interface BirthDialogProps {
  /** The Site editing of the page around the dialog: the dialog saves the Birth through it. */
  editing: SiteEditing;
  /** The form of the page around the dialog: the name, the Sex and the Birth video are its values, and show on it too. */
  page: UseFormReturn<EditorValues>;
  /** Called once the Birth is saved, with the Site as saved and the Birth video the save sent, before the dialog closes. */
  onSaved: (written: Site, sentVideo: MediaDraft) => void;
  previewSlug?: string;
  /** The Site's Address, where the notification comes from. */
  address: string;
  /** What the page shows in place of a birth photo. */
  bornPlaceholderUrl: MediaUrl;
  onClose: () => void;
}

/** What the dialog's rules read beside its values. */
interface BirthContext {
  editing: SiteEditing;
  page: Pick<UseFormReturn<EditorValues>, 'getValues'>;
  /** Whether the dialog asks the name and the Sex too, and so shows their errors itself. */
  asksIdentity: boolean;
  lang: Lang;
}

/** The dialog's field that shows the error at each path of the Birth details. */
const FIELDS: Record<string, string> = {
  'birth.details.datetime': 'datetime',
  'birth.details.weightGrams': 'weight',
  'birth.details.lengthCm': 'lengthCm',
};

/** Sorts a Site settings error for the dialog: under its field, in words, or as one of the page behind it. */
function birthErrors(found: Parameters<typeof settingsErrors>[0], { asksIdentity, page, lang }: BirthContext) {
  return settingsErrors<BirthDraft>(found, {
    form: { birthDialog: { asksIdentity } },
    nameOf: (path) => FIELDS[path] ?? path.replace(/^birth\.details\./, ''),
    languages: page.getValues('languages'),
    lang,
  });
}

/** The dialog's rules: everything that stops saving its Birth with what the page holds (`birthProblems`). */
const birthResolver: Resolver<BirthDraft, BirthContext> = (values, context) => {
  if (!context) {
    return { values, errors: {} };
  }
  const held = holding(context.page.getValues(), context.editing.getState());
  const found = birthProblems(held, values);
  return found.length === 0 ? { values, errors: {} } : { values: {}, errors: birthErrors(found, context) };
};

/**
 * The Birth details on a page of their own: announcing the birth, or changing
 * what was announced. The Birth as typed is the dialog's own form (ADR-0012):
 * nothing changes until the Owner saves, and closing discards it. Saving
 * saves the Birth with the name, the Sex and the Birth video, which are the
 * page's and show on it too.
 */
export function BirthDialog({
  editing,
  page,
  onSaved,
  previewSlug,
  address,
  bornPlaceholderUrl,
  onClose,
}: BirthDialogProps) {
  const saved = useStore(editing);
  // Every value of the page's form has a default, so what it holds is always whole.
  const pageValues = useWatch({ control: page.control }) as EditorValues;
  const { babyName, sex, languages, video } = pageValues;
  const held = holding(pageValues, saved);
  const { slug, timezone } = saved.stored;
  /** The Birth the dialog opened on: as saved, or with now as its date and time when announcing. */
  const [initial] = useState(() => birthToEdit(held));
  const pageLang = useLang();
  const t = platformCopy[pageLang].settings;
  const announcing = !initial.born;
  /** Asked once, when the dialog opens, so the fields stay while the Owner fills them in. */
  const [asksIdentity] = useState(announcing && (!babyName.trim() || sex === 'unknown'));
  const revealed = announcing ? revealedText(t, { name: !pageValues.showName, sex: !pageValues.showSex }) : null;
  const context: BirthContext = { editing, page, asksIdentity, lang: pageLang };
  const form = useForm<BirthDraft, BirthContext>({
    defaultValues: { ...initial, born: true },
    resolver: birthResolver,
    context,
    reValidateMode: 'onSubmit',
    shouldFocusError: false,
  });
  const { control, handleSubmit, setValue, setError } = form;
  const { errors, isSubmitting: saving, submitCount } = form.formState;
  const draft = useWatch({ control }) as BirthDraft;
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [confirmingAnnounce, setConfirmingAnnounce] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  /** The previews keep the last Site settings that were whole while a field is half filled. */
  const lastSettings = useRef<SiteSettings | null>(null);
  lastSettings.current = birthPreview(held, draft) ?? lastSettings.current;
  const photoUrl = useBirthMediaUrl(draft.photo, previewSlug, 'photo');
  const videoUrl = useBirthMediaUrl(video, previewSlug, 'video');

  useRecheckErrors(form, pageValues);
  useFocusFirstError(submitCount, contentRef);

  function inlineError(name: string): string | undefined {
    return (get(errors, name) as { message?: string } | undefined)?.message;
  }

  function update(patch: Partial<BirthDraft>) {
    for (const key of Object.keys(patch) as (keyof BirthDraft)[]) {
      setValue(key, patch[key] as never);
    }
  }

  function closeConfirmations() {
    setConfirmingUndo(false);
    setConfirmingAnnounce(false);
  }

  async function send(birth: BirthDraft) {
    const sent = page.getValues();
    const answer = await editing.getState().saveBirth(sent, birth);
    if (answer.ok) {
      onSaved(answer.site, sent.video);
      onClose();
      return;
    }
    closeConfirmations();
    if ('errors' in answer) {
      markErrors(form, birthErrors(answer.errors, context));
    } else {
      setError('root.server', { message: routeErrorText(answer.refused, pageLang) });
    }
  }

  /** Saves what the dialog holds, once it passes its rules; what stops it shows under the confirmation it closes. */
  const saveChecked = handleSubmit(send, closeConfirmations);
  // Announcing sends the notification at once, so it asks first: a slip of the finger cannot announce.
  const submit = handleSubmit((birth) => (announcing ? setConfirmingAnnounce(true) : send(birth)));

  /** Goes back to the Countdown: the Birth as held, not born. A refusal leaves the dialog on the Birth it held. */
  async function undo() {
    setValue('born', false);
    await saveChecked();
    setValue('born', true);
  }

  const status = errors.root?.server?.message || statusText(t, errors, pageLang);
  const { stale } = saved;

  return (
    <FullPageDialog
      open
      title={announcing ? t.birthDialogTitle(babyName.trim(), sex) : t.birthEditTitle}
      description={announcing ? t.birthDialogDescription : t.birthEditDescription}
      closeLabel={t.closeBirthDialog}
      busy={saving}
      onClose={onClose}
      onSubmit={(e) => void submit(e)}
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
                <Input
                  value={babyName}
                  onChange={(e) => page.setValue('babyName', e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <SegmentedControl
                legend={t.sex}
                options={[
                  { value: 'female', label: t.sexFemale },
                  { value: 'male', label: t.sexMale },
                ]}
                value={sex}
                onChange={(picked) => page.setValue('sex', picked)}
              />
            </Card>
          ) : null}
          <Card title={t.birthDetailsCard} headingLevel={3}>
            <Field label={t.birthDatetime} hint={t.birthDatetimeHint(timezone)} error={inlineError('datetime')}>
              <Input
                type="datetime-local"
                value={draft.datetime}
                onChange={(e) => update({ datetime: e.target.value })}
              />
            </Field>
            <div className={styles.pair}>
              <Field label={t.weight} optional error={inlineError('weight')}>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={draft.weight}
                  onChange={(e) => update({ weight: e.target.value })}
                />
              </Field>
              <Field label={t.length} optional error={inlineError('lengthCm')}>
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
              errors={Object.fromEntries(languages.map((lang) => [lang, inlineError(`message.${lang}`)]))}
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
          <BirthMediaEditor
            only="video"
            headingLevel={3}
            previewSlug={previewSlug}
            video={video}
            onVideo={(picked) => page.setValue('video', picked)}
          />
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
        onConfirm={() => void saveChecked()}
        onClose={() => setConfirmingAnnounce(false)}
      />
      <ConfirmDialog
        open={confirmingUndo}
        title={t.unannounceTitle}
        description={t.unannounceDescription}
        confirmLabel={t.unannounce}
        dismissLabel={t.keepBirthDetails}
        busy={saving}
        onConfirm={() => void undo()}
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
function statusText(t: (typeof platformCopy)[Lang]['settings'], errors: object, lang: Lang): string | null {
  const { marked, status, elsewhere } = errorSummary(errors);
  return (
    [
      ...status,
      elsewhere.length > 0 ? `${t.fixElsewhere} ${elsewhere.join(' ')}` : null,
      marked ? errorsCopy[lang].checkMarkedFields : null,
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
