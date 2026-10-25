import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useState } from 'react';
import { userEvent, within } from 'storybook/test';
import { Combobox } from './Combobox';
import { Field } from './Field';

type Suggestion = { key: string; address: string };

const PLACES: Suggestion[] = [
  { key: '1', address: "Ospedale Niguarda, Piazza dell'Ospedale Maggiore 3, 20162 Milano, Italia" },
  { key: '2', address: 'Via Roma 12, 20121 Milano, Italia' },
  { key: '3', address: 'Via Roma, 00184 Roma, Italia' },
  { key: '4', address: 'Piazza del Duomo, 50122 Firenze, Italia' },
  { key: '5', address: 'Parco Sempione, 20154 Milano, Italia' },
];

/** Finds the PLACES that hold what was typed, after a pause like a network call's. */
function useFakeSearch(text: string) {
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (text.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      setResults(PLACES.filter((place) => place.address.toLowerCase().includes(text.trim().toLowerCase())));
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [text]);
  return { results, loading };
}

const meta = {
  title: 'Components/Combobox',
  component: Combobox<Suggestion>,
  tags: ['autodocs'],
  args: {
    value: '',
    onValueChange: () => undefined,
    options: [],
    getOptionKey: (place: Suggestion) => place.key,
    renderOption: (place: Suggestion) => place.address,
    onSelect: () => undefined,
    listLabel: 'Places',
  },
  render: function ComboboxStory(args) {
    const [value, setValue] = useState(args.value);
    return (
      <Field label="Place" optional hint="Everyone who opens your page sees this place on a map.">
        <Combobox
          {...args}
          value={value}
          onValueChange={setValue}
          onSelect={(place) => setValue(place.address)}
          clear={{ label: 'Remove the place', onClear: () => setValue('') }}
        />
      </Field>
    );
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: '24rem', maxWidth: '32rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Combobox<Suggestion>>;

export default meta;
type Story = StoryObj<typeof meta>;

const openList: Story['play'] = async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole('combobox'));
  await userEvent.keyboard('{ArrowDown}');
};

/**
 * Type at least three letters to search, as the Place field does: the
 * suggestions come after a pause, the arrow keys move through them, Enter
 * or a tap picks one and Escape closes the list.
 */
export const Searching: Story = {
  render: function SearchingStory(args) {
    const [value, setValue] = useState('');
    const { results, loading } = useFakeSearch(value);
    const searched = value.trim().length >= 3 && !loading;
    const found = results.length > 0 ? `${results.length} places found` : 'No places match';
    return (
      <Field label="Place" optional hint="Everyone who opens your page sees this place on a map.">
        <Combobox
          {...args}
          value={value}
          onValueChange={setValue}
          options={results}
          loading={loading}
          status={searched ? found : undefined}
          onSelect={(place) => setValue(place.address)}
          clear={{ label: 'Remove the place', onClear: () => setValue('') }}
        />
      </Field>
    );
  },
};

/** The list open on the suggestions for what was typed, with how many there are. */
export const Suggestions: Story = {
  args: { value: 'Milano', options: PLACES.filter((p) => p.address.includes('Milano')), status: '3 places found' },
  play: openList,
};

/** While the caller searches, the Spinner turns in the control. */
export const Loading: Story = {
  args: { value: 'Ospedale Nig', loading: true },
  play: openList,
};

/** A search with nothing to suggest says so, and says how to go on. */
export const NoMatches: Story = {
  args: { value: 'Via Inesistente 999', status: 'No places match. Try a street, a town or a hospital.' },
  play: openList,
};

/** When the search fails, the list says the Owner can carry on without it. */
export const Unavailable: Story = {
  args: {
    value: 'Via Roma',
    status: 'Search is unavailable right now. You can save the milestone without a place.',
  },
  play: openList,
};

/** A picked suggestion fills the control; the clear button empties it. */
export const Picked: Story = {
  args: { value: 'Via Roma 12, 20121 Milano, Italia' },
};

/** The Field's error marks the control invalid, as for text typed and never picked. */
export const Invalid: Story = {
  args: { value: 'Via Rom' },
  render: function InvalidStory(args) {
    const [value, setValue] = useState(args.value);
    return (
      <Field label="Place" optional error="Pick a place from the list, or clear the field.">
        <Combobox
          {...args}
          value={value}
          onValueChange={setValue}
          clear={{ label: 'Remove the place', onClear: () => setValue('') }}
        />
      </Field>
    );
  },
};

/** Without a visible label, the Combobox needs its own `aria-label`. */
export const WithoutField: Story = {
  args: { 'aria-label': 'Place', placeholder: 'Search for an address' },
  render: function WithoutFieldStory(args) {
    const [value, setValue] = useState('');
    return <Combobox {...args} value={value} onValueChange={setValue} />;
  },
};
