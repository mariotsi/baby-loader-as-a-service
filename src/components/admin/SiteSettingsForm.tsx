'use client';

import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { type SubmitEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Field } from '@/components/ui/Field';
import { FontPicker } from '@/components/ui/FontPicker';
import { Input } from '@/components/ui/Input';
import { LanguagesPicker } from '@/components/ui/LanguagesPicker';
import { PalettePicker } from '@/components/ui/PalettePicker';
import { Select } from '@/components/ui/Select';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { Switch } from '@/components/ui/Switch';
import { Textarea } from '@/components/ui/Textarea';
import { englishName, type Lang } from '@/lib/i18n';
import type { Milestone, SiteDTO } from '@/lib/site';
import type { BirthDetails, Signature, SiteSettingsInput } from '@/lib/siteSettings';
import styles from './SiteSettingsForm.module.css';
import { describeSiteSettingsErrors } from './siteSettingsErrorText';

const LOCAL_DATETIME = "yyyy-MM-dd'T'HH:mm";

/**
 * The texts written, one per language, as the Birth message and the
 * Signature hold them: a text in a Language the Site no longer speaks is kept.
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
  const [signature, setSignature] = useState<Signature>(site.signature);
  const [milestones, setMilestones] = useState<Milestone[]>(site.milestones);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function addMilestone() {
    setMilestones([...milestones, { label: '', date: '' }]);
  }
  function updateMilestone(i: number, patch: Partial<Milestone>) {
    setMilestones(milestones.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function removeMilestone(i: number) {
    setMilestones(milestones.filter((_, idx) => idx !== i));
  }

  async function save(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const settings: SiteSettingsInput = {
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
      milestones: milestones.filter((m) => m.label && m.date),
      languages,
      timezone,
      theme: { palette, font },
      privacy: { showName, showSex },
      signature: writtenTexts(signature),
    };
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
      setMessage(data?.errors ? describeSiteSettingsErrors(data.errors) : data?.error || 'Something went wrong.');
    }
  }

  const saved = message === 'Saved.';

  return (
    <form onSubmit={save} className={styles.form}>
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
                {languages.map((lang) => (
                  <Field key={lang} label={`Message${languages.length > 1 ? ` (${englishName(lang)})` : ''}`} optional>
                    <Textarea
                      value={birthMessage[lang] ?? ''}
                      onChange={(e) => setBirthMessage({ ...birthMessage, [lang]: e.target.value })}
                    />
                  </Field>
                ))}
              </>
            ) : null}
          </Card>

          <Card title="Milestones" description="The little moments of your story, in date order on your page.">
            {milestones.length > 0 ? (
              <ol className={styles.milestones}>
                {milestones.map((m, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Milestones have no id; each row edits and removes the Milestone at its index.
                  <li className={styles.milestone} key={i}>
                    <Input
                      className={styles.milestoneLabel}
                      placeholder="The first kick"
                      aria-label={`Milestone ${i + 1} label`}
                      value={m.label}
                      onChange={(e) => updateMilestone(i, { label: e.target.value })}
                    />
                    <Input
                      className={styles.milestoneDate}
                      type="date"
                      aria-label={`Milestone ${i + 1} date`}
                      value={m.date}
                      onChange={(e) => updateMilestone(i, { date: e.target.value })}
                    />
                    <Button
                      size="sm"
                      icon="trash"
                      onClick={() => removeMilestone(i)}
                      aria-label={`Remove milestone ${i + 1}`}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ol>
            ) : null}
            <div>
              <Button variant="ghost" icon="plus" onClick={addMilestone}>
                Add milestone
              </Button>
            </div>
          </Card>
        </div>

        <div className={styles.column}>
          <Card title="Appearance" description="The colors, letters and words of your page.">
            <PalettePicker value={palette} onChange={setPalette} />
            <FontPicker value={font} onChange={setFont} sample={babyName.trim() || 'Aa'} />
            <LanguagesPicker value={languages} onChange={setLanguages} />
            {languages.map((lang) => (
              <Field
                key={lang}
                label={`Signature${languages.length > 1 ? ` (${englishName(lang)})` : ''}`}
                hint="Your names, or anything you'd like to sign the page with."
                optional
              >
                <Input
                  value={signature[lang] ?? ''}
                  onChange={(e) => setSignature({ ...signature, [lang]: e.target.value })}
                  placeholder="Stefania & Simone"
                  maxLength={60}
                  autoComplete="off"
                />
              </Field>
            ))}
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
        <StatusMessage tone="danger">{message && !saved ? message : null}</StatusMessage>
      </div>
    </form>
  );
}
