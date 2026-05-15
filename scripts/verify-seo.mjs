import { readFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.join(process.cwd(), 'dist');
const siteUrl = process.env.SITE_URL ?? 'https://yaiiii.com';

const readDist = async (relativePath) => {
	const filePath = path.join(distDir, relativePath);
	return readFile(filePath, 'utf8');
};

const assertIncludes = (content, expected, message) => {
	if (!content.includes(expected)) {
		throw new Error(`${message}\nMissing: ${expected}`);
	}
};

const assertMatches = (content, pattern, message) => {
	if (!pattern.test(content)) {
		throw new Error(`${message}\nPattern: ${pattern}`);
	}
};

const assertExcludes = (content, unexpected, message) => {
	if (content.includes(unexpected)) {
		throw new Error(`${message}\nUnexpected: ${unexpected}`);
	}
};

const run = async () => {
	const homeHtml = await readDist('index.html');
	const postsHtml = await readDist('posts/index.html');
	const articleHtml = await readDist('posts/2026-05-14-agent-subagent-invocation/index.html');
	const agentSkillHtml = await readDist('posts/2026-05-15-when-to-use-agent-or-skill/index.html');
	const robotsTxt = await readDist('robots.txt');
	const sitemapXml = await readDist('sitemap.xml');

	assertIncludes(articleHtml, '<title>Agent 如何唤起 SubAgent | 派</title>', 'Article title tag should come from frontmatter.');
	assertIncludes(articleHtml, 'content="用一篇文章讲清楚 Agent 唤起 SubAgent 的时机、方式、提示词模板和调度原则。"', 'Article description meta should come from frontmatter.');
	assertMatches(articleHtml, /<h1 class="article-title"[^>]*>Agent 如何唤起 SubAgent<\/h1>/, 'Article header should render the frontmatter title.');
	assertExcludes(articleHtml, 'Anonymous', 'Article should not fall back to Anonymous when author exists.');
	assertExcludes(articleHtml, '1970-01-01', 'Article should not fall back to 1970-01-01 when pubDate exists.');
	assertMatches(articleHtml, /<div class="article-content"[^>]*>\s*<p>/, 'Article body should start with paragraph content instead of a duplicate H1.');

	assertIncludes(homeHtml, `<link rel="canonical" href="${siteUrl}/">`, 'Homepage should emit a canonical URL.');
	assertIncludes(postsHtml, `<link rel="canonical" href="${siteUrl}/posts">`, 'Posts index should emit a canonical URL.');
	assertIncludes(articleHtml, `<link rel="canonical" href="${siteUrl}/posts/2026-05-14-agent-subagent-invocation">`, 'Article page should emit a canonical URL.');
	assertExcludes(homeHtml, 'http-equiv="refresh"', 'Homepage should no longer use a meta refresh redirect.');
	assertIncludes(homeHtml, '写作、笔记与问题拆解', 'Homepage should be a real landing page instead of a redirect shell.');
	assertIncludes(articleHtml, 'application/ld+json', 'Article page should expose JSON-LD structured data.');
	assertIncludes(articleHtml, 'property="og:image"', 'Article page should emit an Open Graph image.');
	assertIncludes(agentSkillHtml, '<title>什么时候使用 Agent，什么时候使用 Skill | 派</title>', 'New article title tag should come from frontmatter.');
	assertIncludes(agentSkillHtml, 'content="从任务不确定性、复用频率、执行风险和知识沉淀四个角度，讲清楚什么时候该用 Agent，什么时候该写 Skill。"', 'New article description meta should come from frontmatter.');
	assertIncludes(agentSkillHtml, '<html lang="zh-CN">', 'New article should render the frontmatter language.');
	assertIncludes(agentSkillHtml, '/images/articles/agent-vs-skill/agent-vs-skill-cover.svg', 'New article should render the cover image.');
	assertExcludes(agentSkillHtml, '图片信息', 'Article page should not render image notes below the article.');
	assertExcludes(agentSkillHtml, '风格：', 'Article page should not render image style notes.');
	assertExcludes(agentSkillHtml, '来源：', 'Article image notes should not expose implementation/source wording.');
	assertMatches(agentSkillHtml, /<h1 class="article-title"[^>]*>什么时候使用 Agent，什么时候使用 Skill<\/h1>/, 'New article header should render the frontmatter title.');

	assertIncludes(robotsTxt, 'User-agent: *', 'robots.txt should allow crawler access.');
	assertIncludes(robotsTxt, `Sitemap: ${siteUrl}/sitemap.xml`, 'robots.txt should advertise sitemap.xml.');

	assertIncludes(sitemapXml, `<loc>${siteUrl}/</loc>`, 'Sitemap should include homepage.');
	assertIncludes(sitemapXml, `<loc>${siteUrl}/posts</loc>`, 'Sitemap should include posts index.');
	assertIncludes(sitemapXml, `<loc>${siteUrl}/posts/2026-05-14-agent-subagent-invocation</loc>`, 'Sitemap should include article page.');
	assertIncludes(sitemapXml, `<loc>${siteUrl}/posts/2026-05-15-when-to-use-agent-or-skill</loc>`, 'Sitemap should include the new Agent versus Skill article page.');
};

run().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
