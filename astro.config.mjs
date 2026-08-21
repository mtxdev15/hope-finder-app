// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    /* strictPort belongs to Vite, not Astro. It sat in Astro's `server`
       block, which has no such property, so `astro check` flagged it and Vite
       never received it — the dev server would silently fall back to the next
       free port instead of failing loudly on a busy 4321. Same behaviour
       intended, now actually wired. */
    server: {
      strictPort: true,
    },
  },

  server: {
    port: 4321,
  },

  integrations: [react()],
});
