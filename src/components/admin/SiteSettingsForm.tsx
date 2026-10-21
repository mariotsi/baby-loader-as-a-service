'use client';

import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Lang } from '@/lib/i18n';
import type { Milestone, SiteDTO } from '@/lib/site';
import type { BirthDetails, SiteSettingsInput } from '@/lib/siteSettings';
import { FONTS, PALETTES } from '@/lib/theme';
import { describeSiteSettingsErrors } from './siteSettingsErrorText';

const LOCAL_DATETIME = "yyyy-MM-dd'T'HH:mm";
const LANGUAGE_NAMES: Record<Lang, string> = { it: 'Italian', en: 'English' };

export function SiteSettingsForm({ site }: { site: SiteDTO }) {
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
  const [language, setLanguage] = useState(site.language);
  const [palette, setPalette] = useState(site.theme.palette);
  const [font, setFont] = useState(site.theme.font);
  const [showName, setShowName] = useState(site.privacy.showName);
  const [showSex, setShowSex] = useState(site.privacy.showSex);
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

  const messageLangs: Lang[] = language === 'both' ? ['it', 'en'] : [language];

  async function save() {
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
              // Every message written is kept, also one the current Language mode does not show.
              message: Object.fromEntries(Object.entries(birthMessage).filter(([, text]) => text)),
            },
          }
        : { born: false, details: null },
      milestones: milestones.filter((m) => m.label && m.date),
      language,
      theme: { palette, font },
      privacy: { showName, showSex },
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

  return (
    <div className="stack" style={{ marginTop: '1.5rem' }}>
      <div className="card stack">
        <h2>Baby details</h2>
        <div className="field">
          <label htmlFor="settings-name">Name</label>
          <input id="settings-name" value={babyName} onChange={(e) => setBabyName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="settings-sex">Sex</label>
          <select id="settings-sex" value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}>
            <option value="unknown">Prefer not to say</option>
            <option value="female">Girl</option>
            <option value="male">Boy</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="settings-due-date">Due date</label>
          <input id="settings-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <label className="row" style={{ gap: '0.5rem' }}>
          <input type="checkbox" checked={born} onChange={(e) => setBorn(e.target.checked)} />
          The baby has been born
        </label>
        {born ? (
          <>
            <div className="field">
              <label htmlFor="settings-birth-datetime">Birth date &amp; time</label>
              <input
                id="settings-birth-datetime"
                type="datetime-local"
                value={birthDatetime}
                onChange={(e) => setBirthDatetime(e.target.value)}
              />
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="settings-weight">Weight (g)</label>
                <input id="settings-weight" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="settings-length">Length (cm)</label>
                <input
                  id="settings-length"
                  type="number"
                  value={lengthCm}
                  onChange={(e) => setLengthCm(e.target.value)}
                />
              </div>
            </div>
            {messageLangs.map((lang) => (
              <div className="field" key={lang}>
                <label htmlFor={`settings-birth-message-${lang}`}>
                  Message{messageLangs.length > 1 ? ` (${LANGUAGE_NAMES[lang]})` : ''}
                </label>
                <textarea
                  id={`settings-birth-message-${lang}`}
                  value={birthMessage[lang] ?? ''}
                  onChange={(e) => setBirthMessage({ ...birthMessage, [lang]: e.target.value })}
                  rows={3}
                />
              </div>
            ))}
          </>
        ) : null}
      </div>

      <div className="card stack">
        <h2>Milestones</h2>
        {milestones.map((m, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Milestones have no id; each row edits and removes the Milestone at its index.
          <div className="row" key={i}>
            <input
              placeholder="Label"
              aria-label={`Milestone ${i + 1} label`}
              value={m.label}
              onChange={(e) => updateMilestone(i, { label: e.target.value })}
              style={{ flex: 1 }}
            />
            <input
              type="date"
              aria-label={`Milestone ${i + 1} date`}
              value={m.date}
              onChange={(e) => updateMilestone(i, { date: e.target.value })}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => removeMilestone(i)}
              aria-label={`Remove milestone ${i + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={addMilestone} style={{ alignSelf: 'flex-start' }}>
          + Add milestone
        </button>
      </div>

      <div className="card stack">
        <h2>Appearance</h2>
        <div className="field">
          <fieldset className="swatches">
            <legend className="field-label">Palette</legend>
            <div className="row">
              {PALETTES.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPalette(p.id)}
                  className={`swatch${palette === p.id ? ' selected' : ''}`}
                  style={{ background: p.vars['--accent'] }}
                  title={p.name}
                />
              ))}
            </div>
          </fieldset>
        </div>
        <div className="field">
          <label htmlFor="settings-font">Font</label>
          <select id="settings-font" value={font} onChange={(e) => setFont(e.target.value)}>
            {FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="settings-language">Language</label>
          <select
            id="settings-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as typeof language)}
          >
            <option value="en">English only</option>
            <option value="it">Italiano only</option>
            <option value="both">Both (visitor picks)</option>
          </select>
        </div>
        <label className="row" style={{ gap: '0.5rem' }}>
          <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
          Show name on the public page
        </label>
        <label className="row" style={{ gap: '0.5rem' }}>
          <input type="checkbox" checked={showSex} onChange={(e) => setShowSex(e.target.checked)} />
          Show sex on the public page
        </label>
      </div>

      {message ? <p className={message === 'Saved.' ? 'success-text' : 'error-text'}>{message}</p> : null}
      <button type="button" className="btn" onClick={save} disabled={saving} style={{ alignSelf: 'flex-start' }}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
