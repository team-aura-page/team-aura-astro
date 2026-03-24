// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://teamaura.pages.dev',
  compressHTML: true,
  integrations: [sitemap()],
});