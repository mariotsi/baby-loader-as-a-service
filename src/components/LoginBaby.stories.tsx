import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LoginBaby } from './LoginBaby';

const meta = {
  title: 'Pages/LoginBaby',
  component: LoginBaby,
  tags: ['autodocs'],
  args: { state: 'sleeping', look: 0 },
  argTypes: {
    state: { control: 'inline-radio', options: ['sleeping', 'awake', 'watching', 'covering'] },
    look: { control: { type: 'range', min: -1, max: 1, step: 0.1 } },
  },
} satisfies Meta<typeof LoginBaby>;

export default meta;
type Story = StoryObj<typeof meta>;

/** On load, before the Owner touches a field: closed eyes and a zZz that floats a few seconds, then rests. */
export const Sleeping: Story = {};

/** Typing the email: the eyes follow its end, from -1 at the field's start to 1 at its end. Try the `look` control. */
export const Watching: Story = { args: { state: 'watching', look: 0.6 } };

/** Typing the password: the arms rise from the card's edge and the hands cover the eyes. */
export const Covering: Story = { args: { state: 'covering' } };

/** Neither field focused, after the first one was. */
export const Awake: Story = { args: { state: 'awake' } };
