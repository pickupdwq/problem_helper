---
layout: ../../layouts/ArticleLayout.astro
title: "Agent 和 Skill 怎么配合才不乱"
lang: "zh-CN"
pubDate: 2026-03-25
updatedDate: 2026-05-15
description: "用通俗方式讲清楚 Agent 与 Skill 的配合边界：Agent 负责判断，Skill 负责稳定流程，别把两者混成一团。"
author: "派"
tags: ["混合智能", "Agent架构", "Skill设计", "工作流"]
draft: false
cover:
  src: "/images/articles/hybrid-intelligence/hybrid-cover.svg"
  alt: "Agent 与 Skill 协作关系示意图"
  caption: "Agent 负责判断和调度，Skill 负责稳定执行和经验沉淀。"
  style: "浅色系统关系图，双核心协作"
images:
  - src: "/images/articles/hybrid-intelligence/hybrid-decision-flow.svg"
    alt: "Agent 与 Skill 协作决策流程"
    caption: "先判断不确定性和风险，再决定用 Agent、Skill，还是两者配合。"
    style: "决策流程图，浅色技术图表"
---

Agent 和 Skill 最容易被做乱的地方，是边界不清。

有些团队把 Agent 当万能调度器，什么细节都让它临场判断。结果每次输出都不稳定。有些团队又把 Skill 写得像百科全书，什么背景知识都塞进去。结果 Skill 很长，但真正改变不了 Agent 的行为。

更实用的理解是：**Agent 负责处理变化，Skill 负责固定经验。**

## 本文要点

- Agent 和 Skill 不是谁替代谁，而是分工不同。
- 需要判断、探索、验证的任务交给 Agent。
- 稳定、重复、容易漏步骤的流程写成 Skill。
- 两者配合时，要明确谁做决策、谁执行、谁兜底。

<nav class="article-toc" aria-label="快速导航">
	<strong>快速导航</strong>
	<ul>
		<li><a href="#simple-model">先用一个简单模型理解</a></li>
		<li><a href="#when-agent">什么时候让 Agent 主导</a></li>
		<li><a href="#when-skill">什么时候让 Skill 主导</a></li>
		<li><a href="#collaboration">两者怎么配合</a></li>
		<li><a href="#mistakes">常见误区</a></li>
	</ul>
</nav>

<h2 id="simple-model">先用一个简单模型理解</h2>

可以把 Agent 想成一个会行动的项目负责人，把 Skill 想成一份经过验证的操作手册。

项目负责人擅长处理变化：需求不清楚、环境会变、执行中会出错，他能根据反馈调整路线。操作手册擅长保证一致：每次发布前都要检查哪些文件、每次审查代码都要看哪些风险、每次写文章都要准备哪些图片和 SEO 字段。

这两个角色缺一不可。

只有 Agent，没有 Skill，系统会很灵活，但每次都像第一次做。只有 Skill，没有 Agent，流程会很稳定，但遇到新情况就卡住。

<h2 id="when-agent">什么时候让 Agent 主导</h2>

当任务路径不确定时，让 Agent 主导。

比如“这个构建为什么失败”。你无法提前知道原因。可能是依赖版本、类型错误、路径配置、图片资源缺失，也可能是 Markdown frontmatter 写错。此时最重要的是调查、判断、修复、再验证。

这类任务适合 Agent，因为它要边看结果边决定下一步。

典型场景包括：

- 排查未知错误。
- 理解陌生项目。
- 设计一个新功能的实现方案。
- 对多个方案做取舍。
- 根据测试结果连续修复问题。

Skill 在这里不是没用。它可以给 Agent 一份排查顺序，比如先看错误日志，再定位文件，再做最小修改，最后跑验证。但真正的判断仍然要由 Agent 完成。

<h2 id="when-skill">什么时候让 Skill 主导</h2>

当流程稳定、反复发生、容易漏步骤时，让 Skill 主导。

比如文章发布。每次文章内容不同，但流程差不多：确认主题、写 frontmatter、准备封面图、插入正文图、检查锚点、跑构建、不提交 dist、不直接 push。这里最怕的不是 Agent 不聪明，而是漏掉某个固定步骤。

这种经验就应该写进 Skill。

Skill 适合沉淀四类内容：

- 固定流程：先做什么、后做什么。
- 团队偏好：项目用 pnpm，不用 npm。
- 禁止事项：不要 `git add .`，不要发布占位图。
- 完成标准：必须跑什么验证，输出什么结果。

好的 Skill 不追求长，而追求能让 Agent 少犯错。

<h2 id="collaboration">两者怎么配合</h2>

最常见的协作方式是：Agent 判断任务，Skill 提供流程，Agent 执行并验证。

<figure>
	<img src="/images/articles/hybrid-intelligence/hybrid-decision-flow.svg" alt="Agent 与 Skill 协作决策流程" />
	<figcaption>
		<span>任务越不确定，越需要 Agent；流程越重复，越应该沉淀成 Skill。</span>
	</figcaption>
</figure>

拿代码审查举例。

Agent 负责理解这次改动：改了哪些文件、影响哪些功能、有没有明显回归风险。Skill 负责固定审查口径：先列问题，再总结；必须引用文件行号；优先讲行为风险；没有验证就不能说“通过”。

这样配合后，Agent 不会被流程绑死，Skill 也不会变成空泛文档。

再拿文章修改举例。

Agent 负责判断哪几篇文章最空、该怎么改。Skill 负责规定文章必须有清楚的开头、快速导航、图片说明、SEO 字段和构建验证。一个负责内容判断，一个负责出版规范。

<h2 id="mistakes">常见误区</h2>

第一个误区：**把 Skill 写成百科**。

Skill 不需要解释所有背景知识。比如“文章发布 Skill”不需要讲 SEO 的历史，它只需要告诉 Agent：哪些字段必须有，图片怎么放，什么时候必须停下来问用户。

第二个误区：**让 Agent 记住所有偏好**。

偏好靠上下文记忆不稳定。今天记得，明天可能忘。凡是团队长期坚持的规则，都应该写进 Skill。

第三个误区：**让 Skill 做全局判断**。

Skill 可以告诉 Agent 怎么审查代码，但不应该替 Agent 判断“这个 PR 能不能合并”。合并要综合测试、风险、业务优先级和人工意见，这属于 Agent 或人的决策范围。

第四个误区：**没有兜底关系**。

Skill 执行失败时怎么办？Agent 是否可以换方案？是否要停下来问用户？如果没有写清楚，协作就会在失败时变乱。

## 结论

Agent 和 Skill 的配合，不需要包装成复杂概念。

记住一句话就够了：**变化交给 Agent，稳定经验写进 Skill。**

当你发现一个任务每次都要重新判断，就让 Agent 主导。当你发现同一套要求反复提醒，就写成 Skill。当两者一起用时，先明确谁判断、谁执行、谁兜底。边界清楚了，系统自然会稳定很多。
