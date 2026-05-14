// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// https://astro.build/config
const site = process.env.SITE_URL ?? 'https://example.com';

export default defineConfig({
	site,
	adapter: vercel({
		webAnalytics: { enabled: true },
	}),
	output: 'server',
});
