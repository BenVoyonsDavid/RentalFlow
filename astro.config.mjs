// @ts-check
import { defineConfig } from 'astro/config';
import wix from '@wix/astro';
import react from "@astrojs/react";
import wixHostingAdapter from "@wix/astro-wix-hosting-adapter";

export default defineConfig({
  output: "server",
  adapter: wixHostingAdapter(),
  integrations: [wix(), react()],
  // Astro 5.18 doesn't support session: false.
  // An explicit in-memory driver prevents the Cloudflare adapter from auto-wiring
  // the SESSION KV binding, which RentalFlow doesn't use.
  session: {
    driver: "memory",
  },
  image: { domains: ["static.wixstatic.com"] },
  security: { checkOrigin: false },
  devToolbar: { enabled: false }
});
