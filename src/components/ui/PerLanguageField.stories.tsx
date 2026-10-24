import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Input } from './Input';
import { PerLanguageField } from './PerLanguageField';
import { Textarea } from './Textarea';

const meta = {
  title: 'Components/PerLanguageField',
  component: PerLanguageField,
  tags: ['autodocs'],
  args: {
    label: 'Label',
    languages: ['en'],
    value: { en: 'The first kick' },
    onChange: () => undefined,
    children: () => null,
  },
  render: function PerLanguageStory(args) {
    const [texts, setTexts] = useState(args.value);
    return (
      <PerLanguageField {...args} value={texts} onChange={(lang, text) => setTexts({ ...texts, [lang]: text })}>
        {({ lang, value, onChange }) => <Input lang={lang} value={value} onChange={(e) => onChange(e.target.value)} />}
      </PerLanguageField>
    );
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 'var(--content-narrow)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PerLanguageField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One Language: a plain field, with no word about Languages. */
export const OneLanguage: Story = {};

/** Two Languages: a control for each, all in view, tagged with its Language. */
export const TwoLanguages: Story = { args: { languages: ['it', 'en'] } };

/** An error in one Language marks that control and shows under it. */
export const ErrorInOneLanguage: Story = {
  args: { languages: ['it', 'en'], errors: { it: 'Write this in Italian.' } },
};

/** With one Language the label can go to screen readers only, when the control's place already says what it is. */
export const LabelHidden: Story = { args: { labelHidden: true } };

/** Any control fits, here a `Textarea`, with a hint for the whole group. */
export const WithTextarea: Story = {
  args: {
    label: 'Message',
    languages: ['it', 'en'],
    value: {},
    optional: true,
    hint: 'A few words under the Birth details.',
  },
  render: function TextareaStory(args) {
    const [texts, setTexts] = useState(args.value);
    return (
      <PerLanguageField {...args} value={texts} onChange={(lang, text) => setTexts({ ...texts, [lang]: text })}>
        {({ lang, value, onChange }) => (
          <Textarea lang={lang} value={value} onChange={(e) => onChange(e.target.value)} />
        )}
      </PerLanguageField>
    );
  },
};
