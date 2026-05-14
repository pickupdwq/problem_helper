# Baoyu-Inspired Blog Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the shared site shell, `/posts` listing page, and article detail layout so the site reads like a minimalist blog inspired by `baoyu.io`, while keeping the existing Astro routes and Markdown content model.

**Architecture:** Concentrate the shared visual language in `src/layouts/Layout.astro`, then update `src/pages/posts/index.astro` and `src/layouts/ArticleLayout.astro` to adopt that shell with page-specific structure and spacing. Because this repo has no dedicated test framework, verification will rely on `pnpm build` plus manual browser checks for `/`, `/posts`, and an article detail page.

**Tech Stack:** Astro 6, `.astro` layouts/pages, Markdown content, `pnpm`

---

## File Structure

- Modify: `src/layouts/Layout.astro`
  - Responsibility: define shared metadata defaults, top navigation, page shell, and global typography tokens.
- Modify: `src/pages/posts/index.astro`
  - Responsibility: reshape the post list into a vertical reading flow with title, summary, and date metadata.
- Modify: `src/layouts/ArticleLayout.astro`
  - Responsibility: align article headers, metadata, tags, and long-form body styles with the new shell.
- Modify: `src/pages/index.astro`
  - Responsibility: keep the redirect page visually consistent with the new site shell.
- Verify with: `package.json`
  - Use: `pnpm build`, `pnpm dev`

### Task 1: Establish the shared minimalist site shell

**Files:**
- Modify: `src/layouts/Layout.astro`

- [ ] **Step 1: Confirm the current site builds before changing layout markup**

Run:

```bash
pnpm build
```

Expected: Astro build completes successfully and writes output to `dist/`.

- [ ] **Step 2: Replace the current default title handling with a site-level brand and add the shared shell markup**

Update `src/layouts/Layout.astro` so it provides a reusable header and main content frame:

```astro
---
interface Props {
	title?: string;
	description?: string;
}

const siteTitle = 'Problem Helper';

const {
	title = siteTitle,
	description = '面向持续阅读的极简博客',
} = Astro.props;

const pageTitle = title === siteTitle ? title : `${title} | ${siteTitle}`;
---

<!doctype html>
<html lang="zh-CN">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<meta name="description" content={description} />
		<meta name="generator" content={Astro.generator} />
		<meta property="og:title" content={pageTitle} />
		<meta property="og:description" content={description} />
		<meta property="og:type" content="website" />
		<meta property="og:locale" content="zh_CN" />
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:title" content={pageTitle} />
		<meta name="twitter:description" content={description} />
		<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
		<link rel="icon" href="/favicon.ico" />
		<title>{pageTitle}</title>
	</head>
	<body>
		<div class="site-shell">
			<header class="site-header">
				<div class="site-header-inner">
					<a class="site-brand" href="/posts">{siteTitle}</a>
					<nav class="site-nav" aria-label="主导航">
						<a href="/posts">文章</a>
					</nav>
				</div>
			</header>
			<main class="site-main">
				<slot />
			</main>
		</div>
	</body>
</html>
```

- [ ] **Step 3: Add global styles for typography, spacing, links, and the shared content column**

Replace the existing `<style>` block in `src/layouts/Layout.astro` with a global style block like this:

```astro
<style is:global>
	:root {
		color-scheme: light;
		--page-bg: #fbfbf8;
		--panel-border: rgba(15, 23, 42, 0.08);
		--text-primary: #1f2937;
		--text-secondary: #6b7280;
		--text-muted: #9ca3af;
		--link-color: #1f2937;
		--link-hover: #0f172a;
		--content-width: 46rem;
		--shell-width: min(100%, 56rem);
	}

	html {
		background: var(--page-bg);
	}

	html,
	body {
		margin: 0;
		width: 100%;
		min-height: 100%;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
		background: var(--page-bg);
		color: var(--text-primary);
		line-height: 1.75;
	}

	body {
		-webkit-font-smoothing: antialiased;
		text-rendering: optimizeLegibility;
	}

	* {
		box-sizing: border-box;
	}

	a {
		color: var(--link-color);
		text-decoration: none;
	}

	a:hover {
		color: var(--link-hover);
	}

	img {
		max-width: 100%;
		display: block;
	}

	.site-shell {
		min-height: 100vh;
		padding: 0 1.25rem 4rem;
	}

	.site-header {
		padding: 1.5rem 0 2.5rem;
	}

	.site-header-inner {
		width: var(--shell-width);
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.site-brand,
	.site-nav a {
		font-size: 0.95rem;
	}

	.site-brand {
		font-weight: 600;
	}

	.site-nav {
		display: flex;
		align-items: center;
		gap: 1rem;
		color: var(--text-secondary);
	}

	.site-main {
		width: var(--shell-width);
		margin: 0 auto;
	}

	@media (max-width: 640px) {
		.site-shell {
			padding: 0 1rem 3rem;
		}

		.site-header {
			padding: 1.25rem 0 2rem;
		}
	}
</style>
```

- [ ] **Step 4: Rebuild after the shared shell change**

Run:

```bash
pnpm build
```

Expected: Astro build still passes after the layout shell and global style changes.

- [ ] **Step 5: Commit the shared shell update**

Run:

```bash
git add src/layouts/Layout.astro
git commit -m "Refine shared blog layout shell"
```

Expected: Git records a commit containing only the layout-shell update.

### Task 2: Rebuild `/posts` into a vertical reading list

**Files:**
- Modify: `src/pages/posts/index.astro`

- [ ] **Step 1: Extend the post mapping with safe summary and date fields**

Update the frontmatter mapping in `src/pages/posts/index.astro` so each post has the display fields the new layout needs:

```astro
const posts = Object.values(allPosts).map((post: any) => {
	const pubDate = post.frontmatter?.pubDate
		? new Date(post.frontmatter.pubDate)
		: new Date(0);

	return {
		...post,
		frontmatter: post.frontmatter,
		url: post.url,
		pubDate,
		formattedDate: pubDate.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		}),
		description: post.frontmatter?.description ?? '',
	};
});

const sortedPosts = posts.sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
```

- [ ] **Step 2: Replace the single-line list markup with article-style entries**

Rewrite the page body in `src/pages/posts/index.astro` so it reads like a blog home:

```astro
<Layout title="文章" description="最新文章列表">
	<section class="posts-page">
		<header class="posts-header">
			<h1>文章</h1>
			<p>持续更新的写作、笔记与想法。</p>
		</header>

		<div class="posts-feed">
			{sortedPosts.map((post) => (
				<article class="post-entry">
					<h2 class="post-entry-title">
						<a href={post.url}>{post.frontmatter.title}</a>
					</h2>
					{post.description && <p class="post-entry-summary">{post.description}</p>}
					<div class="post-entry-meta">
						<time datetime={post.pubDate.toISOString()}>{post.formattedDate}</time>
						<a class="post-entry-action" href={post.url}>阅读全文</a>
					</div>
				</article>
			))}
		</div>
	</section>
</Layout>
```

- [ ] **Step 3: Replace the current scoped styles with a minimal feed layout**

Use styles like these in `src/pages/posts/index.astro`:

```astro
<style>
	.posts-page {
		max-width: var(--content-width);
	}

	.posts-header {
		margin-bottom: 3.5rem;
	}

	.posts-header h1 {
		margin: 0;
		font-size: clamp(2rem, 4vw, 2.8rem);
		line-height: 1.15;
		letter-spacing: 0;
	}

	.posts-header p {
		margin: 0.85rem 0 0;
		font-size: 1rem;
		color: var(--text-secondary);
	}

	.posts-feed {
		display: grid;
		gap: 3rem;
	}

	.post-entry-title {
		margin: 0;
		font-size: clamp(1.5rem, 3vw, 2rem);
		line-height: 1.25;
	}

	.post-entry-summary {
		margin: 0.9rem 0 0;
		font-size: 1rem;
		color: var(--text-secondary);
	}

	.post-entry-meta {
		margin-top: 1rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		font-size: 0.92rem;
		color: var(--text-muted);
	}

	.post-entry-action {
		color: var(--text-primary);
	}

	@media (max-width: 640px) {
		.posts-header {
			margin-bottom: 2.75rem;
		}

		.posts-feed {
			gap: 2.5rem;
		}
	}
</style>
```

- [ ] **Step 4: Rebuild and manually inspect the new feed page**

Run:

```bash
pnpm build
pnpm dev
```

Manual checks:

- Open `http://localhost:4321/posts`
- Confirm the header reads as a blog list, not a directory row
- Confirm each entry shows title, optional summary, and date/action metadata without card borders

Expected: Build passes, and the page reads like a narrow-column article feed.

- [ ] **Step 5: Commit the `/posts` feed refresh**

Run:

```bash
git add src/pages/posts/index.astro
git commit -m "Restyle posts listing page"
```

Expected: Git records a focused commit for the `/posts` page refresh.

### Task 3: Align article detail pages with the new reading system

**Files:**
- Modify: `src/layouts/ArticleLayout.astro`

- [ ] **Step 1: Simplify article metadata and remove the unused updated-date variable**

Update the frontmatter in `src/layouts/ArticleLayout.astro` to keep only the fields that the page renders:

```astro
const {
	title,
	description,
	pubDate = '1970-01-01',
	author = 'Anonymous',
	tags = [],
} = Astro.props;

const pubDateObj = pubDate ? new Date(pubDate) : new Date();
const formattedDate = pubDateObj.toLocaleDateString('en-US', {
	year: 'numeric',
	month: 'long',
	day: 'numeric',
});
```

- [ ] **Step 2: Replace the article header markup with a lighter structure**

Rewrite the article skeleton in `src/layouts/ArticleLayout.astro` like this:

```astro
<Layout title={title} description={description}>
	<article class="article-page">
		<header class="article-header">
			<h1 class="article-title">{title}</h1>
			<div class="article-meta">
				<span>{author}</span>
				<span class="meta-divider">/</span>
				<time datetime={pubDateObj.toISOString()}>{formattedDate}</time>
			</div>
			{tags.length > 0 && (
				<ul class="article-tags" aria-label="文章标签">
					{tags.map((tag) => <li>{tag}</li>)}
				</ul>
			)}
		</header>
		<div class="article-content">
			<slot />
		</div>
	</article>
</Layout>
```

- [ ] **Step 3: Replace the heavy bordered styles with reading-oriented typography**

Use styles like these in `src/layouts/ArticleLayout.astro`:

```astro
<style>
	.article-page {
		max-width: var(--content-width);
	}

	.article-header {
		margin-bottom: 3rem;
	}

	.article-title {
		margin: 0;
		font-size: clamp(2.2rem, 5vw, 3.4rem);
		line-height: 1.1;
		letter-spacing: 0;
	}

	.article-meta {
		margin-top: 1rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		font-size: 0.95rem;
		color: var(--text-secondary);
	}

	.meta-divider {
		color: var(--text-muted);
	}

	.article-tags {
		list-style: none;
		padding: 0;
		margin: 1rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		color: var(--text-secondary);
		font-size: 0.92rem;
	}

	.article-content {
		font-size: 1.08rem;
		color: var(--text-primary);
	}

	.article-content :global(p),
	.article-content :global(ul),
	.article-content :global(ol),
	.article-content :global(blockquote),
	.article-content :global(pre) {
		margin: 1.35rem 0;
	}

	.article-content :global(h2) {
		margin: 3rem 0 1rem;
		font-size: 1.7rem;
		line-height: 1.25;
	}

	.article-content :global(h3) {
		margin: 2.25rem 0 0.85rem;
		font-size: 1.3rem;
		line-height: 1.3;
	}

	.article-content :global(a) {
		text-decoration: underline;
		text-decoration-color: rgba(31, 41, 55, 0.25);
		text-underline-offset: 0.18em;
	}

	.article-content :global(blockquote) {
		padding-left: 1rem;
		border-left: 2px solid rgba(31, 41, 55, 0.18);
		color: var(--text-secondary);
	}

	.article-content :global(pre) {
		padding: 1.1rem 1.25rem;
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.72);
		overflow-x: auto;
	}

	.article-content :global(code) {
		font-family: 'SFMono-Regular', 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
		font-size: 0.92em;
	}

	.article-content :global(:not(pre) > code) {
		padding: 0.15rem 0.35rem;
		border-radius: 4px;
		background: rgba(15, 23, 42, 0.05);
	}

	@media (max-width: 640px) {
		.article-header {
			margin-bottom: 2.25rem;
		}

		.article-content {
			font-size: 1rem;
		}
	}
</style>
```

- [ ] **Step 4: Rebuild and inspect an article page**

Run:

```bash
pnpm build
pnpm dev
```

Manual checks:

- Open `http://localhost:4321/posts/2024-01-15-test-article`
- Confirm title, author/date row, tags, headings, lists, and blockquote spacing all fit the new minimalist system
- Confirm no thick header border or pill-style tags remain

Expected: Build passes and the article page feels visually consistent with the `/posts` list.

- [ ] **Step 5: Commit the article layout refresh**

Run:

```bash
git add src/layouts/ArticleLayout.astro
git commit -m "Align article layout with blog refresh"
```

Expected: Git records a focused commit for the article detail layout.

### Task 4: Bring the redirect page into the same shell and run final verification

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Rewrite the redirect content so it fits inside the shared shell**

Replace the visible content in `src/pages/index.astro` with a minimal intro that works under the new header:

```astro
<Layout title="首页" description="正在跳转到文章页面">
	<meta http-equiv="refresh" content="0;url=/posts" />
	<section class="redirect-page">
		<p>正在前往文章列表。</p>
		<a href="/posts">如果没有自动跳转，点击这里继续</a>
	</section>
</Layout>
```

- [ ] **Step 2: Replace the full-screen centering styles with restrained spacing**

Use scoped styles like these in `src/pages/index.astro`:

```astro
<style>
	.redirect-page {
		max-width: var(--content-width);
		padding-top: 3rem;
		color: var(--text-secondary);
	}

	.redirect-page p {
		margin: 0;
		font-size: 1rem;
	}

	.redirect-page a {
		display: inline-block;
		margin-top: 0.85rem;
		color: var(--text-primary);
	}
</style>
```

- [ ] **Step 3: Run the final build and full manual review**

Run:

```bash
pnpm build
pnpm dev
```

Manual checks:

- Open `http://localhost:4321/`
- Open `http://localhost:4321/posts`
- Open `http://localhost:4321/posts/2024-01-15-test-article`
- Check the same pages again at a narrow mobile viewport

Expected:

- The shared header and page column feel consistent across all three routes
- `/posts` looks like a quiet article feed, not a utility list
- The article detail page preserves readability for headings, lists, links, and code
- The redirect page no longer feels like a disconnected full-screen placeholder

- [ ] **Step 4: Commit the redirect-page cleanup and final verification state**

Run:

```bash
git add src/pages/index.astro
git commit -m "Polish redirect page for blog layout"
```

Expected: Git records the redirect-page update after the final verification pass.
