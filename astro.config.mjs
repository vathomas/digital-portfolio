// @ts-check
// Force .env values to override any empty/stale shell environment variables.
// This runs before Vite processes import.meta.env, so the correct key values
// are available in both process.env and import.meta.env across all API routes.
import { configDotenv } from 'dotenv';
configDotenv({ override: true });

import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel({ webAnalytics: { enabled: true } }),
  site: 'https://thomas-abraham.vercel.app',
  integrations: [
    react(),
    sitemap({
      // Exclude API routes and dynamic preview/internal endpoints from the
      // sitemap — they're not indexable content.
      filter: (page) => !page.includes('/api/'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
