// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://teamaura.pages.dev',
  compressHTML: true,
  integrations: [sitemap()],
  adapter: cloudflare(),
});