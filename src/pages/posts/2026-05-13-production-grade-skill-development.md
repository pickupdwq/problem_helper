---
layout: ../../layouts/ArticleLayout.astro
title: "构建生产级Skill：完整开发流程与最佳实践"
lang: "zh-CN"
pubDate: 2026-05-13
updatedDate: 2026-05-13
description: "把 Skill 真正做进生产环境时，最该关注的是边界、验证、版本和失败处理，而不是把提示词写得更长。"
author: "派"
tags: ["生产环境", "开发流程", "最佳实践", "Skill工程化"]
draft: false
---

Skill 真正进入生产后，最先坏掉的通常不是“模型不够聪明”，而是边界不清、验证不足、回滚没写。原型 Skill 只要在一次对话里能跑通就行，生产 Skill 则必须像一个契约：什么时候触发、能做什么、不能做什么、失败后怎么办，全都要写死。

## 本文要点

- 生产级 Skill 不是“长提示词”，而是一份可执行的契约
- 最重要的不是内容多，而是触发条件、范围、验证和失败处理写清楚
- Skill 一旦进入多人协作，就要有版本、变更记录和负责人
- 只要涉及删除、发布、权限变更，就不能把最终判断交给模型自己做

## 先给 Skill 定边界

一个生产级 Skill，至少要回答这五个问题：

1. 什么时候触发它。
2. 它能碰哪些文件、模块或资源。
3. 它绝对不能做什么。
4. 它怎么判断自己做对了。
5. 如果失败，下一步怎么办。

如果这五件事答不清楚，这个 Skill 还停留在原型阶段。

## 一份能上线的 Skill，至少要写清楚这 5 项

```yaml
trigger:
  - 用户明确要求进入某个流程
scope:
  include: ["src/pages/posts/**"]
  exclude: ["dist/**", ".git/**"]
forbidden:
  - "不要执行破坏性命令"
  - "不要覆盖用户未授权的改动"
validate:
  - "pnpm build"
  - "必要时跑针对性检查"
fallback:
  - "如果信息不足，先停下来问"
```

这不是模板摆设。它直接决定这个 Skill 会不会在第一次跑偏时把你带进坑里。

## 不要把 Skill 写成百科

很多 Skill 写着写着就变成说明书，最后没人真的用。

我现在更倾向于把 Skill 写得短一点，只保留三类内容：

- 操作顺序
- 禁止事项
- 完成标准

背景知识、理论解释、行业常识，放在别处。Skill 不是给人上课的，它是给后续的 Agent 和协作者减摩擦的。

## 怎么测试 Skill

生产级 Skill 不能只看“能不能成功”，还要看“失败时会不会乱来”。

我会至少测四类情况：

1. 正常路径：最常见的输入能不能顺利走完。
2. 边界路径：缺字段、空输入、格式错误时会不会停住。
3. 反向路径：让它执行不该做的事情时，会不会被规则拦住。
4. 验证路径：改完之后，能不能通过构建、测试或人工检查。

如果你做的是文章发布、代码审查、迁移脚本、目录清理这类事情，测试还应该包含“不要误操作”的场景。很多事故不是因为模型不会做，而是因为它做过头了。

## 怎么维护

Skill 一旦进入多人协作，就不能靠记忆维护。

我建议至少补这三项：

- 版本号
- 变更记录
- 负责人

版本号不一定要复杂，但至少要让人看出哪些规则变过，哪些行为已经废弃。变更记录的目的也不是写漂亮，而是让后面接手的人知道这条规则为什么存在。

## 一个更现实的判断

一个 Skill 如果满足下面这几点，才算真的接近生产：

- 别人可以不读背景也知道它干什么
- 它不会碰不该碰的东西
- 它失败时会停下来，而不是硬做
- 它改过一次后，下次还能稳定复用

反过来，如果一个 Skill 需要你每次都口头补很多说明，那它还没真正沉淀下来。

## 结语

我现在不太相信“生产级 Skill”这种大词本身。我只相信几件很朴素的事：边界写清楚，验证写清楚，失败处理写清楚，版本写清楚。

只要这四样做到了，Skill 才算真的能进日常工作流。否则它只是一个看起来很完整的提示词。

## 数据来源

- [OpenAI Codex overview](https://platform.openai.com/docs/codex/overview)
- [OpenAI Codex product page](https://openai.com/codex/)
- [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- [GitHub Copilot code review docs](https://docs.github.com/en/copilot/concepts/agents/code-review)
- [GitHub Copilot code review usage](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/copilot-code-review)
- [GitHub Copilot code review instructions](https://docs.github.com/en/copilot/using-github-copilot/code-review/using-copilot-code-review?tool=vscode#providing-instructions-for-copilot-code-reviews)
