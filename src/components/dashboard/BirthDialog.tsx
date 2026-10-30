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
import { StatusMessage } from '@/components/ui/StatusMessage';
import { Textarea } from '@/components/ui/Textarea';
import { errorsCopy } from '@/lib/copy/errors';
import { platformCopy } from '@/lib/copy/platform';
import { describeSiteSettingsErrors, inlineErrorText } from '@/lib/errorText';
import type { Lang } from '@/lib/i18n';
import type { BirthDetails, SiteSettings, SiteSettingsError } from '@/lib/siteSettings';
import { BirthMediaEditor, type MediaDraft } from './BirthMediaEditor';
import styles from './SiteSettingsForm.module.css';

/** The Birth as the editor holds it: the fields as typed, and the photo picked but maybe not yet uploaded. */
export interface BirthDraft {
  born: boolean;
  /** A `datetime-local` value, in the Owner's own time. */
  datetime: string;
  weight: string;
  lengthCm: string;
  message: BirthDetails['message'];
  photo: MediaDraft;
}

/** How saving the whole page went: the errors are the Site settings', from the browser or the server. */
export type SaveOutcome = { ok: true } | { ok: false; errors: SiteSettingsError[]; message: string | null };

interface BirthDialogProps {
  /** The Birth as it was saved; announcing starts from it with the date and time filled in. */
  initial: BirthDraft;
  babyName: string;
  sex: SiteSettings['sex'];
  languages: Lang[];
  previewSlug?: string;
  /** Everything that would stop saving the page with this Birth. */
  check: (birth: BirthDraft) => SiteSettingsError[];
  /** Saves the whole page with this Birth, the Owner's other changes included. */
  onSave: (birth: BirthDraft) => Promise<SaveOutcome>;
  onClose: () => void;
}

/**
 * The Birth details on a page of their own: announcing the birth, or changing
 * what was announced. Nothing changes until the Owner saves, and saving saves
 * the whole Site settings, so the page and the dialog never disagree.
 */
export function BirthDialog({
  initial,
  babyName,
  sex,
  languages,
  previewSlug,
  check,
  onSave,
  onClose,
}: BirthDialogProps) {
  const pageLang = useLang();
  const t = platformCopy[pageLang].settings;
  const announcing = !initial.born;
  const [draft, setDraft] = useState<BirthDraft>(() => ({ ...initial, born: true }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failedPaths, setFailedPaths] = useState<string[]>([]);
  const [failedSaves, setFailedSaves] = useState(0);
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (failedSaves > 0) {
      contentRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [failedSaves]);

  const errors = failedPaths.length > 0 ? check(draft).filter((error) => failedPaths.includes(error.path)) : [];
  const elsewhere = errors.filter((error) => !error.path.startsWith('birth.'));

  function inlineError(path: string): string | undefined {
    const error = errors.find((e) => e.path === path);
    return error ? inlineErrorText(error, languages, pageLang) : undefined;
  }

  function update(patch: Partial<BirthDraft>) {
    setDraft({ ...draft, ...patch });
  }

  async function save(birth: BirthDraft) {
    setMessage(null);
    const found = check(birth);
    if (found.length > 0) {
      setFailedPaths(found.map((error) => error.path));
      setFailedSaves((count) => count + 1);
      return;
    }
    setFailedPaths([]);
    setSaving(true);
    const outcome = await onSave(birth);
    if (outcome.ok) {
      return;
    }
    setSaving(false);
    setConfirmingUndo(false);
    setMessage(outcome.message);
    if (outcome.errors.length > 0) {
      setFailedPaths(outcome.errors.map((error) => error.path));
      setFailedSaves((count) => count + 1);
    }
  }

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    void save(draft);
  }

  const birthErrors = errors.filter((error) => error.path.startsWith('birth.') && !inlinePath(error.path));
  const status =
    message ||
    [
      birthErrors.length > 0 ? describeSiteSettingsErrors(birthErrors, pageLang) : null,
      elsewhere.length > 0 ? `${t.fixElsewhere} ${describeSiteSettingsErrors(elsewhere, pageLang)}` : null,
      errors.some((error) => inlinePath(error.path)) ? errorsCopy[pageLang].checkMarkedFields : null,
    ]
      .filter(Boolean)
      .join(' ') ||
    null;

  return (
    <FullPageDialog
      open
      title={announcing ? t.birthDialogTitle(babyName.trim(), sex) : t.birthEditTitle}
      description={announcing ? t.birthDialogDescription : t.birthEditDescription}
      closeLabel={t.closeBirthDialog}
      busy={saving}
      onClose={onClose}
      onSubmit={submit}
      actions={
        <>
          <StatusMessage tone="danger">{status}</StatusMessage>
          <Button onClick={() => !saving && onClose()}>{t.cancel}</Button>
          <Button variant="primary" type="submit" icon={announcing ? 'sparkles' : undefined} loading={saving}>
            {submitLabel(t, announcing, saving)}
          </Button>
        </>
      }
    >
      <div ref={contentRef} className={styles.column}>
        <Card title={t.birthDetailsCard} headingLevel={3}>
          <Field label={t.birthDatetime} error={inlineError('birth.details.datetime')}>
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
        {announcing ? null : (
          <div>
            <Button variant="ghost" icon="trash" onClick={() => setConfirmingUndo(true)}>
              {t.unannounce}
            </Button>
          </div>
        )}
      </div>
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

function submitLabel(t: (typeof platformCopy)[Lang]['settings'], announcing: boolean, saving: boolean): string {
  if (announcing) {
    return saving ? t.announcing : t.announceBirth;
  }
  return saving ? t.saving : t.save;
}

/** The Birth errors the dialog shows under their field; the status message says the rest in words. */
function inlinePath(path: string): boolean {
  return /^birth\.details\.(datetime|weightGrams|lengthCm|message\.[a-z]+)$/.test(path);
}
