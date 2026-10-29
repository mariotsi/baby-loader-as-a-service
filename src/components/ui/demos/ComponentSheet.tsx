'use client';

import { type ReactNode, useState } from 'react';
import type { Lang } from '@/lib/i18n';
import { Badge } from '../Badge';
import { Button, ButtonLink } from '../Button';
import { Card } from '../Card';
import { Checkbox } from '../Checkbox';
import { Checklist } from '../Checklist';
import { Combobox } from '../Combobox';
import { ConfirmDialog } from '../ConfirmDialog';
import { EmojiPicker } from '../EmojiPicker';
import { ExternalLink } from '../ExternalLink';
import { Field } from '../Field';
import { Input } from '../Input';
import { LanguagesPicker } from '../LanguagesPicker';
import { Logo } from '../Logo';
import { PerLanguageField } from '../PerLanguageField';
import { SegmentedControl } from '../SegmentedControl';
import { Select } from '../Select';
import { Spinner } from '../Spinner';
import { Stack } from '../Stack';
import { StatusMessage } from '../StatusMessage';
import { Switch } from '../Switch';
import { Textarea } from '../Textarea';
import styles from './sheet.module.css';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <h3 className={styles.groupTitle}>{title}</h3>
      {children}
    </div>
  );
}

/**
 * Every base component in its main states, in whatever theme surrounds it.
 * `themeName` keeps the titled Card's region name unique when the sheet
 * renders once per Palette.
 */
export function ComponentSheet({ headingLevel = 2, themeName }: { headingLevel?: 2 | 3; themeName?: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sex, setSex] = useState<'female' | 'male' | 'unknown'>('unknown');
  const [languages, setLanguages] = useState<Lang[]>(['it', 'en']);
  const [emoji, setEmoji] = useState('🍼');
  const [place, setPlace] = useState('Via Roma 12, 20121 Milano, Italia');
  const [label, setLabel] = useState<Partial<Record<Lang, string>>>({ en: 'The first kick' });
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className={styles.sheet}>
      <Heading className={styles.heading}>Components</Heading>
      <Group title="External links">
        <ExternalLink href="https://support.apple.com/">Open Apple Support</ExternalLink>
      </Group>
      <Group title="Confirmation">
        <Button variant="link" inline onClick={() => setConfirmOpen(true)}>
          Turn off notifications
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          title="Turn off notifications?"
          description="You will stop receiving notifications from this page on this device."
          confirmLabel="Turn off notifications"
          dismissLabel="Keep notifications on"
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => setConfirmOpen(false)}
        />
      </Group>
      <Group title="Buttons">
        <Stack direction="row" gap={3}>
          <Button variant="primary" icon="sparkles">
            Create page
          </Button>
          <Button>Preview</Button>
          <Button variant="ghost" icon="plus">
            Add milestone
          </Button>
          <Button variant="primary" loading>
            Saving…
          </Button>
          <Button size="sm" icon="trash">
            Remove
          </Button>
          <ButtonLink href="#top" variant="secondary" icon="external" iconPosition="end">
            View page
          </ButtonLink>
        </Stack>
      </Group>
      <Group title="Form controls">
        <div className={styles.grid}>
          <Field label="Baby's name" hint="You can hide it until the birth.">
            <Input defaultValue="Emma" />
          </Field>
          <Field label="Page address" error="Someone got there first. Try emma-2026." required>
            <Input defaultValue="emma" />
          </Field>
          <Field label="Due date" optional>
            <Input type="date" defaultValue="2026-09-12" />
          </Field>
          <Field label="Place" optional hint="Everyone who opens your page sees this place on a map.">
            <Combobox
              value={place}
              onValueChange={setPlace}
              options={[]}
              getOptionKey={(option: string) => option}
              renderOption={(option) => option}
              onSelect={setPlace}
              clear={{ label: 'Remove the place', onClear: () => setPlace('') }}
              listLabel="Places"
            />
          </Field>
          <Field label="Timezone">
            <Select defaultValue="Europe/Rome">
              <option>Europe/London</option>
              <option>Europe/Rome</option>
              <option>America/New_York</option>
            </Select>
          </Field>
          <Field label="Birth message" className={styles.wide}>
            <Textarea defaultValue="Mum, baby (and dad) are doing great!" />
          </Field>
          <div className={styles.wide}>
            <PerLanguageField
              label="Milestone label"
              languages={languages}
              value={label}
              onChange={(lang, text) => setLabel({ ...label, [lang]: text })}
              errors={label.it ? {} : { it: 'Write this Milestone in Italian.' }}
            >
              {({ lang, value, onChange }) => (
                <Input lang={lang} value={value} onChange={(e) => onChange(e.target.value)} />
              )}
            </PerLanguageField>
          </div>
        </div>
      </Group>
      <Group title="Choices">
        <div className={styles.grid}>
          <div>
            <Checkbox label="The baby has been born" defaultChecked />
            <Checkbox label="Send me a copy" />
          </div>
          <div>
            <Switch label="Show the name while waiting" defaultChecked />
            <Switch label="Show the sex while waiting" />
          </div>
          <SegmentedControl
            legend="Sex"
            value={sex}
            onChange={setSex}
            options={[
              { value: 'female', label: 'Girl' },
              { value: 'male', label: 'Boy' },
              { value: 'unknown', label: 'Rather not say' },
            ]}
          />
          <LanguagesPicker value={languages} onChange={setLanguages} />
          <EmojiPicker value={emoji} onChange={setEmoji} label="Milestone emoji" />
        </div>
      </Group>
      <Group title="Feedback">
        <Stack gap={2} align="start">
          <StatusMessage tone="success">Saved. Your page is up to date.</StatusMessage>
          <StatusMessage tone="info">Sent to 12 of 12 subscribers.</StatusMessage>
          <StatusMessage tone="danger">Couldn't save your changes. Try again.</StatusMessage>
          <Checklist
            items={[
              { id: 'length', label: 'At least 10 characters', met: true },
              { id: 'upper', label: 'An uppercase letter', met: false },
            ]}
            flagUnmet
          />
          <Stack direction="row" gap={2}>
            <Badge tone="highlight" icon="star">
              Recommended
            </Badge>
            <Badge>Optional</Badge>
            <Badge size="sm">Optional</Badge>
          </Stack>
          <Stack direction="row" gap={4} align="center">
            <Spinner size="lg" tone="brand" label="Loading" />
            <Spinner label="Loading" />
            <Logo />
          </Stack>
        </Stack>
      </Group>
      <Card
        title={themeName ? `A card in ${themeName}` : 'A card'}
        description="Groups related settings, like Baby details."
        headingLevel={3}
      >
        <Field label="Name">
          <Input defaultValue="Emma" />
        </Field>
      </Card>
    </div>
  );
}
