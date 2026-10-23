import type { StorybookConfig } from '@storybook/nextjs-vite';
import remarkGfm from 'remark-gfm';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: [
    // MDX renders only CommonMark; remark-gfm adds the tables the docs pages use.
    {
      name: '@storybook/addon-docs',
      options: { mdxPluginOptions: { mdxCompileOptions: { remarkPlugins: [remarkGfm] } } },
    },
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
  ],
  framework: { name: '@storybook/nextjs-vite', options: {} },
  staticDirs: ['../public'],
  core: { disableTelemetry: true },
};

export default config;
