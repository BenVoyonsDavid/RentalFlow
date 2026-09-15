// @ts-check
import { defineConfig, envField } from 'astro/config';
import wix from '@wix/astro';
import react from "@astrojs/react";
import wixHostingAdapter from "@wix/astro-wix-hosting-adapter";

export default defineConfig({
  output: "server",
  adapter: wixHostingAdapter(),
  integrations: [wix(), react()],
  env: {
    schema: {
      STRIPE_SECRET_KEY_TEST: envField.string({ context: 'server', access: 'secret', optional: true }),
      STRIPE_PUBLISHABLE_KEY_TEST: envField.string({ context: 'server', access: 'secret', optional: true }),
      STRIPE_SECRET_KEY_LIVE: envField.string({ context: 'server', access: 'secret', optional: true }),
      STRIPE_PUBLISHABLE_KEY_LIVE: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  image: { domains: ["static.wixstatic.com"] },
  security: { checkOrigin: false },
  devToolbar: { enabled: false }
});
