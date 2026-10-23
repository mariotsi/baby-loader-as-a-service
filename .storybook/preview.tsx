import type { Decorator, Preview } from '@storybook/nextjs-vite';
import type { CSSProperties } from 'react';
import '../src/app/globals.css';
import { FONTS, googleFontsHref, PALETTES, PLATFORM_FONT, PLATFORM_PALETTE, tokenStyle } from '../src/lib/theme';

const ALL_PALETTES = [PLATFORM_PALETTE, ...PALETTES];
const ALL_FONTS = [PLATFORM_FONT, ...FONTS];

const fonts = document.createElement('link');
fonts.rel = 'stylesheet';
fonts.href = googleFontsHref(ALL_FONTS);
document.head.appendChild(fonts);

/**
 * Themes every story with the Palette and Font picked in the toolbar, as a
 * Site or the Platform would. A story with `parameters.page` is a whole page
 * and brings its own spacing.
 */
const withTheme: Decorator = (Story, { globals, parameters, viewMode }) => {
  const palette = ALL_PALETTES.find((p) => p.id === globals.palette) ?? PLATFORM_PALETTE;
  const font = ALL_FONTS.find((f) => f.id === globals.font) ?? PLATFORM_FONT;
  const style = {
    ...tokenStyle(palette, font),
    minHeight: viewMode === 'docs' ? undefined : '100dvh',
    padding: parameters.page ? 0 : '1.5rem',
  } as CSSProperties;
  return (
    <div className="themed-region" style={style}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    palette: {
      description: 'Palette the story is themed with',
      toolbar: {
        title: 'Palette',
        icon: 'paintbrush',
        items: ALL_PALETTES.map((p) => ({ value: p.id, title: p.name })),
        dynamicTitle: true,
      },
    },
    font: {
      description: 'Font the story is themed with',
      toolbar: {
        title: 'Font',
        icon: 'paragraph',
        items: ALL_FONTS.map((f) => ({ value: f.id, title: f.name })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { palette: PLATFORM_PALETTE.id, font: PLATFORM_FONT.id },
  parameters: {
    options: {
      storySort: {
        order: [
          'Design system',
          ['Introduction', 'Using the components', 'Rules for new components', 'Tokens'],
          'Playground',
          'Demos',
          'Components',
        ],
      },
    },
    layout: 'fullscreen',
    a11y: { test: 'error' },
    controls: { expanded: true },
    nextjs: { appDirectory: true },
    viewport: {
      options: {
        phone: { name: 'Phone (375)', styles: { width: '375px', height: '812px' }, type: 'mobile' },
        smallPhone: { name: 'Small phone (320)', styles: { width: '320px', height: '640px' }, type: 'mobile' },
        tablet: { name: 'Tablet (768)', styles: { width: '768px', height: '1024px' }, type: 'tablet' },
        desktop: { name: 'Desktop (1280)', styles: { width: '1280px', height: '800px' }, type: 'desktop' },
      },
    },
  },
};

export default preview;
