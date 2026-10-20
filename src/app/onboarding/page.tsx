'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { PALETTES, FONTS, DEFAULT_PALETTE, DEFAULT_FONT } from '@/lib/theme';
import { defaultSiteSettings } from '@/lib/siteSettings';
import { describeSiteSettingsErrors } from '@/components/admin/siteSettingsErrorText';

export default function OnboardingPage() {
  const router = useRouter();
  const [slug, setSlug] = useState('');
  const [babyName, setBabyName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [language, setLanguage] = useState<'it' | 'en' | 'both'>('en');
  const [palette, setPalette] = useState(DEFAULT_PALETTE);
  const [font, setFont] = useState(DEFAULT_FONT);
  const [showName, setShowName] = useState(true);
  const [showSex, setShowSex] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          settings: {
            ...defaultSiteSettings,
            babyName,
            dueDate: dueDate || null,
            language,
            theme: { palette, font },
            privacy: { showName, showSex },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors ? describeSiteSettingsErrors(data.errors) : data.error || 'Something went wrong.');
        return;
      }
      router.push(`/admin/${data.tenant.slug}`);
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 520, margin: '2rem auto' }}>
        <h1>Create your waiting page</h1>
        <form onSubmit={onSubmit} className="stack">
          <div className="field">
            <label htmlFor="slug">Site address</label>
            <input
              id="slug"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="emma"
            />
            <span className="muted">yoursite.com will be reachable as {slug || 'slug'}.yoursite.com</span>
          </div>
          <div className="field">
            <label htmlFor="babyName">Baby&apos;s name</label>
            <input id="babyName" required value={babyName} onChange={(e) => setBabyName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="dueDate">Due date</label>
            <input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="language">Language</label>
            <select id="language" value={language} onChange={(e) => setLanguage(e.target.value as typeof language)}>
              <option value="en">English only</option>
              <option value="it">Italiano only</option>
              <option value="both">Both (visitor picks)</option>
            </select>
          </div>
          <div className="field">
            <label>Color palette</label>
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
          </div>
          <div className="field">
            <label htmlFor="font">Font</label>
            <select id="font" value={font} onChange={(e) => setFont(e.target.value)}>
              {FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <label className="row" style={{ gap: '0.5rem' }}>
              <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
              Show name
            </label>
            <label className="row" style={{ gap: '0.5rem' }}>
              <input type="checkbox" checked={showSex} onChange={(e) => setShowSex(e.target.checked)} />
              Show sex
            </label>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create site'}
          </button>
        </form>
      </div>
    </div>
  );
}
