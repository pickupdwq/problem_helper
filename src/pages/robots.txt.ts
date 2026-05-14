import type { APIRoute } from 'astro';

const getRobotsTxt = (sitemapUrl: string) => `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;

export const GET: APIRoute = ({ site }) => {
	const baseUrl = site ?? new URL('https://example.com');
	const sitemapUrl = new URL('/sitemap.xml', baseUrl).toString();

	return new Response(getRobotsTxt(sitemapUrl), {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	});
};
