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
      SQUARE_APPLICATION_ID_TEST: envField.string({ context: 'server', access: 'secret', optional: true }),
      SQUARE_APPLICATION_SECRET_TEST: envField.string({ context: 'server', access: 'secret', optional: true }),
      SQUARE_APPLICATION_ID_LIVE: envField.string({ context: 'server', access: 'secret', optional: true }),
      SQUARE_APPLICATION_SECRET_LIVE: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Master server-only secret used to derive separate AES-GCM and HMAC keys for OAuth tokens/state.
      SQUARE_SECURITY_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  image: { domains: ["static.wixstatic.com"] },
  security: { checkOrigin: false },
  devToolbar: { enabled: false }
});
