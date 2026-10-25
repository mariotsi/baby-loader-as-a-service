import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { googleMapsUrl } from '@/lib/place';
import { MilestonePlace } from './MilestonePlace';

const address = 'Ospedale Niguarda, Via Renato Donatelli, 20162 Milano, Italia';

const meta = {
  title: 'Pages/MilestonePlace',
  component: MilestonePlace,
  tags: ['autodocs'],
  args: {
    place: {
      address,
      lat: 45.5093,
      lon: 9.1899,
      url: googleMapsUrl({ address }),
      linkLabel: `Open ${address} in Google Maps`,
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '28rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MilestonePlace>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A Milestone's Place on its Public page: the map loads as it scrolls into view, and it and the address open Google Maps. */
export const Loaded: Story = {};

/** A dark Palette gets OpenFreeMap's dark style. */
export const DarkPalette: Story = { globals: { palette: 'midnight' } };

/** Without WebGL, or when the map's style or tiles fail, only the address shows. */
export const MapUnavailable: Story = {
  beforeEach: () => {
    const fetch = window.fetch;
    window.fetch = (input, init) =>
      String(input instanceof Request ? input.url : input).includes('openfreemap')
        ? Promise.reject(new TypeError('OpenFreeMap is unreachable in this story'))
        : fetch(input, init);
    return () => {
      window.fetch = fetch;
    };
  },
};
