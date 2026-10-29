import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { FilePicker, type PickedFile } from './FilePicker';

const png = () =>
  new File(
    [
      Uint8Array.from(
        atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),
        (c) => c.charCodeAt(0)
      ),
    ],
    'emma.png',
    { type: 'image/png' }
  );
const photo = { url: '/website-assets/born-placeholder-v1.png', name: 'emma.png', type: 'image/png', size: 249856 };
const video = {
  url: new URL('../dashboard/fixtures/welcome.webm', import.meta.url).href,
  name: 'welcome.webm',
  type: 'video/webm',
  size: 260096,
};
function PickerExample({ initial = null }: { initial?: PickedFile | null }) {
  const [value, setValue] = useState(initial);
  return (
    <FilePicker
      label="Birth media"
      hint="PNG, MP4, WebM · 5 MB"
      accept={['image/png', 'video/mp4', 'video/webm']}
      maxBytes={5 * 1024 * 1024}
      value={value}
      onChange={setValue}
      optional
    />
  );
}
const meta = { title: 'UI/File picker', component: PickerExample, tags: ['autodocs'] } satisfies Meta<
  typeof PickerExample
>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Browse or drop a single supported file. */
export const Empty: Story = {};
/** The selected image shows its name, MIME type, size and thumbnail. */
export const ImageSelected: Story = { args: { initial: photo } };
/** Video previews decode a still frame without playing sound or motion. */
export const VideoSelected: Story = { args: { initial: video } };
/** An unsupported dropped file keeps the last valid selection and shows a recoverable error. */
export const InvalidType: Story = {
  args: { initial: photo },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    dropFile(canvas.getByRole('button'), new File(['document'], 'notes.txt', { type: 'text/plain' }));
    await expect(await canvas.findByText('Choose one of the supported file types.')).toBeVisible();
    await expect(await canvas.findByText('emma.png')).toBeVisible();
  },
};
/** Oversized files are rejected, and a valid replacement clears the error. */
export const ValidationAndRecovery: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const area = canvas.getByRole('button');
    dropFile(area, new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }));
    await waitFor(() => expect(area).toHaveAttribute('aria-invalid', 'true'));
    await userEvent.upload(canvas.getByLabelText('Birth media file'), png());
    await expect(area).not.toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByText('image/png · 0.1 KB')).toBeVisible();
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('emma.png'));
    await expect(area).not.toHaveTextContent('emma.png');
    await expect(canvas.queryByText('File selected')).not.toBeInTheDocument();
  },
};
/** A valid drop follows the same selection and validation path as browsing. */
export const Drop: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const area = canvas.getByRole('button');
    area.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer(png()) }));
    await waitFor(() => expect(area).toHaveAttribute('data-state', 'drag-valid'));
    await expect(getComputedStyle(area).borderTopStyle).toBe('dashed');
    dropFile(area, png());
    await expect(await canvas.findByText('emma.png')).toBeVisible();
    await expect(area).toHaveAttribute('data-state', 'selected');
    await expect(getComputedStyle(area).borderTopStyle).toBe('dashed');
  },
};

function transfer(file: File) {
  const data = new DataTransfer();
  data.items.add(file);
  return data;
}

function dropFile(element: HTMLElement, file: File) {
  element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer(file) }));
}
