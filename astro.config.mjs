// @ts-check
// Force .env values to override any empty/stale shell environment variables.
// This runs before Vite processes import.meta.env, so the correct key values
// are available in both process.env and import.meta.env across all API routes.
import { configDotenv } from 'dotenv';
configDotenv({ override: true });

import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
