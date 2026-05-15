import type { APIRoute } from 'astro';
import { getAllPosts } from '../utils/posts';

const escapeXml = (value: string) =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');

const formatLastModified = (date: Date) => date.toISOString().split('T')[0];

export const GET: APIRoute = ({ site }) => {
	const baseUrl = site ?? new URL('https://yaiiii.com');
	const posts = getAllPosts();
	const latestPostDate = posts[0]?.pubDate ?? new Date();
	const pages = [
		{
			loc: new URL('/', baseUrl).toString(),
			lastmod: formatLastModified(latestPostDate),
		},
		{
			loc: new URL('/posts', baseUrl).toString(),
			lastmod: formatLastModified(latestPostDate),
		},
		...posts.map((post) => ({
			loc: new URL(post.url, baseUrl).toString(),
			lastmod: formatLastModified(post.pubDate),
		})),
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
	.map(
		(page) => `  <url>
    <loc>${escapeXml(page.loc)}</loc>
    <lastmod>${page.lastmod}</lastmod>
  </url>`
	)
	.join('\n')}
</urlset>`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
		},
	});
};
