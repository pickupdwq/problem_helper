import type { MarkdownInstance } from 'astro';

export interface PostFrontmatter {
	title: string;
	description?: string;
	pubDate?: string;
	author?: string;
	tags?: string[];
	draft?: boolean;
}

export interface PostEntry {
	frontmatter: PostFrontmatter;
	url: string;
	pubDate: Date;
	formattedDate: string;
	description: string;
}

const allPosts = import.meta.glob<MarkdownInstance<PostFrontmatter>>('../pages/posts/*.md', {
	eager: true,
});

const formatDate = (pubDate: Date) =>
	pubDate.toLocaleDateString('zh-CN', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});

export const getAllPosts = (): PostEntry[] =>
	Object.values(allPosts)
		.flatMap((post) => {
			if (!post.url || post.frontmatter.draft) {
				return [];
			}

			const pubDate = post.frontmatter.pubDate
				? new Date(post.frontmatter.pubDate)
				: new Date(0);

			return [
				{
					frontmatter: post.frontmatter,
					url: post.url.replace(/\/+$/, ''),
					pubDate,
					formattedDate: formatDate(pubDate),
					description: post.frontmatter.description ?? '',
				},
			];
		})
		.sort((left, right) => right.pubDate.valueOf() - left.pubDate.valueOf());
