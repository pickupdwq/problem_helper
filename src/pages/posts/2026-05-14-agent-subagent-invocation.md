---
layout: ../../layouts/ArticleLayout.astro
title: "Agent 如何唤起 SubAgent"
pubDate: 2026-05-14
description: "用一篇文章讲清楚 Agent 唤起 SubAgent 的时机、方式、提示词模板和调度原则。"
author: "派"
tags: ["AI Agent", "SubAgent", "智能体", "提示词工程"]
draft: false
---

![Agent 与 SubAgent 协作示意图](/images/articles/agent-subagent/agent-subagent-cover.png)

*主 Agent 负责目标、上下文和最终判断，SubAgent 负责边界清晰的局部任务。*

在复杂任务里，单个 Agent 不一定适合从头到尾包办所有事情。更稳妥的做法是：主 Agent 负责理解目标、拆解任务、把控上下文和最终决策；SubAgent 负责处理边界清晰的子任务，比如代码扫描、资料整理、测试验证、局部实现等。

这套模式的重点不是“多开几个 Agent”，而是让每个 Agent 只处理自己能稳定完成的那部分工作。

## 什么是 Agent 和 SubAgent

Agent 可以理解为一个具备目标、上下文、工具调用能力和执行策略的智能执行单元。它不只是回答问题，还会根据任务状态决定下一步行动。

SubAgent 是由主 Agent 派生或调用出来的辅助 Agent。它通常只负责一个具体任务，不直接接管全局目标。

一个常见分工是：

- 主 Agent：负责完成一个功能开发
- SubAgent A：分析现有代码结构
- SubAgent B：实现某个独立模块
- SubAgent C：运行测试并找出失败原因

主 Agent 像调度者，SubAgent 像专门处理局部问题的执行者。主 Agent 不应该把全局判断完全交出去，SubAgent 也不应该拿到一个没有边界的大任务。

## 什么时候应该唤起 SubAgent

![适合唤起 SubAgent 的任务类型](/images/articles/agent-subagent/subagent-task-types.png)

*适合交给 SubAgent 的任务通常有三个特点：独立、边界清楚、结果可验证。*

SubAgent 适合用在这些场景。

第一，任务可以独立完成。比如“检查 API 层的鉴权逻辑”和“补充前端表单校验”之间没有强依赖，就可以拆开处理。

第二，任务需要并行推进。主 Agent 可以继续做主线工作，同时让 SubAgent 去做代码搜索、文档整理或测试验证。

第三，任务边界非常明确。SubAgent 最怕接到模糊任务。好的任务应该说明目标、输入、输出和限制。

第四，任务不应该污染主上下文。比如大量日志分析、长文件阅读、批量检索，都适合交给 SubAgent。

不适合唤起 SubAgent 的情况也很明确：如果下一步必须依赖这个结果，主 Agent 自己做通常更快；如果任务高度耦合，也不应该拆出去。

## 主 Agent 唤起 SubAgent 的基本方式

![主 Agent 唤起 SubAgent 的流程图](/images/articles/agent-subagent/agent-subagent-flow.png)

*典型流程：理解目标 -> 拆解任务 -> 判断并行点 -> 唤起 SubAgent -> 汇总结果。*

典型流程如下：

```text
用户提出目标
    ↓
主 Agent 理解任务
    ↓
主 Agent 拆解子任务
    ↓
主 Agent 判断哪些任务可以并行
    ↓
主 Agent 唤起 SubAgent
    ↓
SubAgent 返回结果或修改
    ↓
主 Agent 汇总、校验、继续推进
```

一次合格的 SubAgent 调用，通常应该包含这些信息：

```text
任务目标：你要完成什么
任务范围：你可以读写哪些文件或处理哪些模块
约束条件：不要改动什么，不要覆盖他人修改
输出要求：最后需要返回什么
完成标准：怎样算完成
```

例如：

```text
请作为 worker SubAgent，负责实现用户设置模块的表单校验。
范围限制在 src/features/settings/ 下。
不要修改 API 层和全局样式。
完成后请说明改动文件、核心逻辑和验证方式。
```

这类提示词有一个好处：SubAgent 一看就知道自己该做什么，也知道哪些事情不该碰。

## 常见的 Agent 唤起方式

Agent 的唤起方式通常有几类。

第一类是用户直接唤起。用户通过自然语言、命令行、按钮或 API 请求启动 Agent，例如：

```text
帮我修复这个测试失败
请分析这个仓库的架构
生成一篇关于 Agent 调度机制的文章
```

第二类是系统事件唤起。系统根据事件自动触发 Agent，例如：

```text
PR 创建后自动触发代码审查 Agent
测试失败后自动触发 Debug Agent
文档更新后自动触发摘要 Agent
```

第三类是主 Agent 调度唤起。这是 SubAgent 最常见的来源。主 Agent 发现任务可以拆分，就创建一个或多个 SubAgent 去处理。

第四类是工作流编排唤起。在固定流程里，不同 Agent 按步骤执行：

```text
需求分析 Agent -> 方案设计 Agent -> 实现 Agent -> 测试 Agent -> 审查 Agent
```

第五类是工具或 API 唤起。业务系统可以通过接口创建 Agent 任务：

```json
{
	"agent_type": "code_reviewer",
	"task": "review current branch",
	"scope": "src/api"
}
```

## 一个实用的调用模板

![SubAgent 调用模板示例](/images/articles/agent-subagent/subagent-prompt-template.png)

*一个好的 SubAgent 调用提示词，应该明确目标、范围、限制、输出和完成标准。*

可以把下面这段作为通用模板：

```text
你是一个 SubAgent，负责一个独立子任务。

目标：
[明确说明要完成的事情]

上下文：
[必要背景，不要塞入无关信息]

范围：
[允许查看或修改的文件、模块、目录]

限制：
[不能做什么，不能改什么]

输出：
[希望它最终返回什么]

完成标准：
[如何判断任务完成]
```

真正使用时，最好把“范围”和“限制”写得比“背景”更具体。背景太多会让 SubAgent 分不清主次，范围太少则容易误改无关内容。

## 唤起 SubAgent 的关键原则

最重要的是边界清楚。SubAgent 不应该收到“看看这个项目有没有问题”这种任务，而应该收到“检查订单模块是否存在未处理的空状态，并列出文件和风险”。

其次是避免重复劳动。主 Agent 不能一边自己做代码扫描，一边让 SubAgent 做同样的扫描。否则结果会冲突，也浪费时间。

最后是主 Agent 必须负责整合。SubAgent 给出的结果只是输入，不是最终结论。主 Agent 需要判断结果是否可信，是否和全局目标一致，是否需要进一步验证。

## 总结

Agent 唤起 SubAgent 的本质，是把复杂任务拆成多个边界清晰、可以独立推进的工作单元。主 Agent 负责方向、判断和整合，SubAgent 负责局部执行。

好的 Agent 调度不是“越多越好”，而是只在合适的时候拆分：任务独立、边界明确、并行有收益、结果容易验证。这样 SubAgent 才能真正提高效率，而不是制造更多上下文混乱。
