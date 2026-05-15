---
layout: ../../layouts/ArticleLayout.astro
title: "Agent与Skill架构设计原则：构建可扩展的AI系统"
lang: "zh-CN"
pubDate: 2025-10-08
updatedDate: 2025-10-08
description: "从分层架构、职责分离、接口设计、扩展点和反模式五个维度，讲清楚如何设计可扩展的Agent与Skill系统。"
author: "派"
tags: ["Agent架构", "Skill设计", "系统架构", "AI工程"]
draft: false
---

构建一个可扩展的AI系统，核心挑战不在模型选择，而在架构设计。Agent和Skill是现代AI系统的两大支柱：Agent负责动态执行，Skill负责沉淀经验。但二者如何组织、如何交互、如何扩展，却很少有系统性的讨论。这篇文章从实际工程经验出发，讲清楚Agent与Skill架构设计的五个关键原则。

## 为什么要分层

大多数AI系统一开始都是扁平的。一个Agent接收任务，直接调用模型，输出结果。这种结构在原型阶段足够用，但随着场景复杂化，问题会逐渐暴露。

第一个问题是职责混杂。同一个Agent既要做任务理解，又要做工具调用，还要做结果验证。上下文越来越长，每次调用都塞满无关信息，模型注意力被稀释，关键指令容易被忽略。

第二个问题是复用困难。一段处理PDF的提示词被复制到三个不同的Agent里，每个都略有不同。更新时漏改一个，行为就开始分叉。

第三个问题是扩展受限。想新增一个数据源接入，必须改现有Agent的提示词。想调整输出格式，可能影响所有下游任务。

分层架构的目标不是增加复杂度，而是把变化隔离在正确的地方。Agent层负责"做什么"，Skill层负责"怎么做"，基础设施层负责"用什么做"。每层只关心自己的职责，层与层之间通过明确接口交互。

## 三层架构模型

我推荐把AI系统分为三层：编排层、能力层、工具层。

编排层由Agent组成，负责理解用户意图、拆解任务、调度执行、整合结果。它是系统的入口，也是全局上下文的持有者。Agent不关心具体怎么调用API，它只决定"需要数据X，请能力层提供"。

能力层由Skill组成，每个Skill是一个完整的能力单元，封装了特定领域的流程和规则。比如"代码审查Skill"知道审查顺序、风险分类、输出格式；"文章发布Skill"知道SEO要求、构建流程、git规范。Skill接收明确的输入，返回结构化的输出。

工具层提供原子操作，比如文件读写、命令执行、API调用、数据库查询。这些操作本身没有业务逻辑，只是基础设施。Skill通过工具层完成具体操作，但工具层不了解任何业务含义。

这个分层可以用一段代码来表达：

```typescript
// 编排层：Agent负责调度
class Agent {
  private skills: Map<string, Skill>;
  private context: Context;

  async execute(task: UserTask): Promise<Result> {
    const plan = await this.plan(task);
    for (const step of plan.steps) {
      const skill = this.skills.get(step.skillId);
      const result = await skill.execute({
        input: step.input,
        context: this.context.slice(step.contextRange),
      });
      this.context.append(result);
    }
    return this.synthesize(this.context);
  }
}

// 能力层：Skill封装具体流程
interface Skill {
  execute(params: SkillParams): Promise<SkillResult>;
}

class CodeReviewSkill implements Skill {
  async execute(params: SkillParams): Promise<SkillResult> {
    // 按固定流程执行审查
    const files = await this.toolLayer.listChangedFiles(params.input);
    const findings = [];
    for (const file of files) {
      const content = await this.toolLayer.readFile(file);
      findings.push(...this.analyze(content));
    }
    return { findings, severity: this.classify(findings) };
  }
}

// 工具层：原子操作
class ToolLayer {
  async readFile(path: string): Promise<string> {
    return fs.readFile(path, 'utf-8');
  }
  async exec(command: string): Promise<ExecResult> {
    return child_process.exec(command);
  }
}
```

这个结构的好处在于：Agent可以灵活组合Skill，Skill可以独立演进，工具层可以替换实现而不影响上层。

## 职责分离：Agent与Skill的边界

分层之后，更关键的是明确每一层的职责边界。模糊边界会导致职责泄漏，最终分层名存实亡。

Agent的职责包括：理解目标、拆解任务、选择策略、管理全局上下文、判断完成度。Agent应该像项目经理，知道大局，但不亲自写每一行代码。

Skill的职责包括：封装特定流程、定义输入输出格式、处理领域内异常、保证输出一致性。Skill应该像专业工程师，接到明确需求后按既定方式高质量完成。

一个常见的反模式是让Agent直接处理本应由Skill负责的细节。比如Agent自己写正则表达式提取数据，而不是调用"数据提取Skill"。这会导致：同样的提取逻辑散落在多个Agent里；提取规则变化时需要改所有Agent；Agent的提示词越来越长。

另一个反模式是让Skill做全局判断。比如一个"代码审查Skill"去决定"是否合并PR"。这是全局决策，应该由Agent根据审查结果、测试状态、分支策略等综合判断后做出。Skill只负责给出审查发现，不负责决策。

清晰的边界可以这样定义：凡是涉及"选择"的，归Agent；凡是涉及"执行"的，归Skill。Agent决定用哪个Skill、什么顺序、什么时候停止；Skill决定具体怎么完成、遵循什么标准、输出什么格式。

## 接口设计：Skill的契约

Skill对外暴露的接口是它的契约。好的契约让调用方清楚知道输入什么、得到什么；差的契约让每次调用都像在开盲盒。

Skill接口应该包含四个要素：触发条件、输入规格、输出格式、边界约束。

触发条件回答"什么时候用这个Skill"。不是每个任务都需要触发所有Skill，明确的触发条件可以减少无效调用。比如"代码审查Skill"的触发条件是"用户要求review代码，或PR被创建"；"文章发布Skill"的触发条件是"用户确认文章已完成，要求发布"。

输入规格定义Skill需要什么数据。越具体越好。比如"代码审查Skill"的输入是"变更文件列表、当前分支、目标分支"，而不是模糊的"给我代码看看"。

输出格式定义Skill返回什么。结构化输出比自由文本更有用。比如审查结果应该包含：文件路径、行号、问题类型、严重程度、建议修改。这样Agent可以直接解析，而不是再让模型去理解一段自然语言。

边界约束定义Skill不会做什么。这比"会做什么"更重要。比如"代码审查Skill"的边界是：不修改代码、不运行测试、不判断是否应该合并。这些约束防止Skill越界，也防止调用方有错误预期。

一个完整的Skill契约可以这样定义：

```typescript
interface SkillContract {
  // 触发条件
  triggers: TriggerCondition[];
  
  // 输入规格
  input: {
    required: string[];
    optional: string[];
    schema: JSONSchema;
  };
  
  // 输出格式
  output: {
    format: 'json' | 'markdown' | 'text';
    schema: JSONSchema;
  };
  
  // 边界约束
  constraints: {
    readonly: string[];      // 不会修改什么
    scope: string;           // 操作范围
    maxDuration: number;     // 最大执行时间
  };
}

// 示例：代码审查Skill的契约
const codeReviewContract: SkillContract = {
  triggers: [
    { type: 'user_intent', pattern: /review|审查|检查/ },
    { type: 'event', event: 'pr.created' },
  ],
  input: {
    required: ['changedFiles', 'baseBranch'],
    optional: ['reviewFocus', 'severityThreshold'],
    schema: {
      type: 'object',
      properties: {
        changedFiles: { type: 'array', items: { type: 'string' } },
        baseBranch: { type: 'string' },
        reviewFocus: { type: 'array', items: { enum: ['security', 'performance', 'style'] } },
      },
    },
  },
  output: {
    format: 'json',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          type: { enum: ['security', 'performance', 'style', 'logic'] },
          severity: { enum: ['critical', 'warning', 'info'] },
          message: { type: 'string' },
          suggestion: { type: 'string' },
        },
      },
    },
  },
  constraints: {
    readonly: ['sourceCode', 'testFiles'],
    scope: 'read-only analysis',
    maxDuration: 120000,
  },
};
```

有了契约，Agent调用Skill时就知道该准备什么数据、期待什么结果。契约也是测试Skill的基础：给固定输入，验证输出是否符合schema。

## 扩展点：让系统能生长

好的架构不是一次性设计完美，而是预留扩展点，让系统能随需求生长。Agent与Skill架构需要四个关键扩展点。

第一个扩展点是Skill注册机制。系统应该支持动态注册和发现Skill，而不是硬编码所有Skill。新的Skill可以以插件形式加入，Agent自动识别并可用。

```typescript
class SkillRegistry {
  private skills = new Map<string, Skill>();

  register(id: string, skill: Skill, contract: SkillContract): void {
    this.skills.set(id, { skill, contract });
  }

  find(trigger: TriggerCondition): SkillEntry[] {
    return Array.from(this.skills.values()).filter((entry) =>
      entry.contract.triggers.some((t) => this.matches(t, trigger))
    );
  }
}

// 使用：新Skill随时注册
registry.register('pdf-extract', new PDFExtractSkill(), pdfContract);
registry.register('code-review', new CodeReviewSkill(), reviewContract);
```

第二个扩展点是上下文策略。不同任务需要不同的上下文管理方式。有的任务需要完整历史，有的只需要最近三轮对话，有的需要按主题分段。上下文策略应该可插拔。

```typescript
interface ContextStrategy {
  select(context: Context, task: Task): ContextSlice;
}

class FullHistoryStrategy implements ContextStrategy {
  select(context: Context): ContextSlice {
    return context.all();
  }
}

class RecentWindowStrategy implements ContextStrategy {
  constructor(private windowSize: number) {}
  select(context: Context): ContextSlice {
    return context.lastN(this.windowSize);
  }
}

class RelevantSegmentStrategy implements ContextStrategy {
  select(context: Context, task: Task): ContextSlice {
    return context.findRelevant(task.keywords);
  }
}
```

第三个扩展点是工具适配器。底层工具可能变化：今天用本地文件系统，明天用对象存储；今天调用OpenAI，明天调用Claude。工具层应该通过适配器隔离变化。

```typescript
interface LLMAdapter {
  complete(prompt: string, options: CompletionOptions): Promise<string>;
}

class OpenAIAdapter implements LLMAdapter {
  async complete(prompt: string, options: CompletionOptions): Promise<string> {
    const response = await openai.chat.completions.create({
      model: options.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature,
    });
    return response.choices[0].message.content;
  }
}

class ClaudeAdapter implements LLMAdapter {
  async complete(prompt: string, options: CompletionOptions): Promise<string> {
    const response = await anthropic.messages.create({
      model: options.model,
      max_tokens: options.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].text;
  }
}
```

第四个扩展点是钩子系统。允许在Skill执行前后插入自定义逻辑，比如日志记录、权限检查、结果缓存、降级处理。

```typescript
interface SkillHooks {
  beforeExecute?: (input: unknown) => Promise<void>;
  afterExecute?: (result: unknown) => Promise<void>;
  onError?: (error: Error) => Promise<ErrorHandlingResult>;
}

class HookedSkill implements Skill {
  constructor(
    private baseSkill: Skill,
    private hooks: SkillHooks
  ) {}

  async execute(params: SkillParams): Promise<SkillResult> {
    if (this.hooks.beforeExecute) {
      await this.hooks.beforeExecute(params.input);
    }
    try {
      const result = await this.baseSkill.execute(params);
      if (this.hooks.afterExecute) {
        await this.hooks.afterExecute(result);
      }
      return result;
    } catch (error) {
      if (this.hooks.onError) {
        return this.hooks.onError(error);
      }
      throw error;
    }
  }
}
```

这四个扩展点覆盖了Skill发现、上下文管理、工具适配和流程增强四个维度，让系统可以在不修改核心逻辑的情况下持续演化。

## 反模式：架构设计的常见陷阱

即使理解了分层和职责分离，实际工程中仍然容易掉进一些常见陷阱。

第一个反模式是"Skill膨胀"。一个Skill试图处理所有相关场景，结果变得庞大而脆弱。比如一个"数据处理Skill"既做PDF提取，又做Excel解析，还做CSV清洗。虽然它们都叫"数据处理"，但实现细节、错误模式、输出格式完全不同。应该拆成三个独立的Skill，共享底层工具即可。

第二个反模式是"Agent包揽一切"。Agent直接操作工具层，绕过Skill。短期看更快，长期看Agent的提示词会变成一锅粥。每次任务变更都要改Agent，而不是改对应的Skill。

第三个反模式是"接口过度设计"。给Skill定义十几种输入参数和输出字段，但90%的场景只用其中两三个。复杂的schema不仅增加维护成本，还会让模型在生成参数时更容易出错。接口应该从小开始，随真实需求增长。

第四个反模式是"忽视错误传播"。Skill执行失败时，错误信息没有结构化，Agent拿到一段自然语言描述，不知道该怎么处理。应该定义标准的错误类型：输入无效、执行超时、依赖缺失、权限不足，每种错误对应不同的恢复策略。

```typescript
class SkillError extends Error {
  constructor(
    message: string,
    public type: 'invalid_input' | 'timeout' | 'dependency_missing' | 'permission_denied',
    public recoverable: boolean,
    public suggestion?: string
  ) {
    super(message);
  }
}

// Agent可以根据错误类型决定策略
try {
  const result = await skill.execute(params);
} catch (error) {
  if (error instanceof SkillError) {
    switch (error.type) {
      case 'invalid_input':
        return this.retryWithFixedInput(error.suggestion);
      case 'timeout':
        return this.degradeToSimplerTask();
      case 'dependency_missing':
        return this.scheduleForLater();
      case 'permission_denied':
        return this.escalateToUser();
    }
  }
}
```

第五个反模式是"静态架构"。一次设计完成后就不再调整，即使业务需求已经变化。架构应该是活的：每增加一个新场景，就审视一次分层是否合理；每发现一次职责泄漏，就重构一次边界。

## 实际案例：构建一个代码助手系统

让我们看一个实际案例。假设要构建一个AI代码助手，功能包括：理解需求、生成代码、运行测试、审查质量、提交PR。

扁平架构的做法是一个超级Agent处理所有事情。提示词包含：如何理解需求、如何生成代码、如何运行测试、如何审查、如何提交。这个Agent的提示词会很快超过上下文窗口，而且任何一个环节的调整都会影响整体。

分层架构的做法是：

编排层有一个主Agent，负责理解用户需求并拆解任务。它不需要知道怎么写测试，只需要知道"需要测试覆盖"，然后调用TestSkill。

能力层有五个Skill：
- RequirementSkill：分析需求文档，提取功能点和验收标准
- CodeGenSkill：根据需求生成代码，遵循项目编码规范
- TestSkill：生成测试用例并运行，报告覆盖率
- ReviewSkill：检查代码质量、安全风险和风格问题
- PublishSkill：准备PR描述、选择审查人、提交代码

工具层提供：文件读写、命令执行、Git操作、测试框架调用、LLM API。

主Agent的调度逻辑：

```typescript
class CodeAssistantAgent {
  async handle(request: UserRequest): Promise<AssistantResult> {
    // 步骤1：理解需求
    const requirements = await this.skills.requirement.analyze(request.description);
    
    // 步骤2：生成代码
    const code = await this.skills.codeGen.generate({
      requirements: requirements.items,
      styleGuide: await this.toolLayer.readFile('.styleguide.md'),
    });
    
    // 步骤3：并行生成测试和审查
    const [testResult, reviewResult] = await Promise.all([
      this.skills.test.run({ code: code.files, requirements: requirements.items }),
      this.skills.review.check({ files: code.files }),
    ]);
    
    // 步骤4：判断是否需要修改
    if (testResult.failed.length > 0 || reviewResult.critical.length > 0) {
      const fixed = await this.skills.codeGen.fix({
        code: code.files,
        testFailures: testResult.failed,
        reviewFindings: reviewResult.critical,
      });
      return this.handle({ ...request, description: `修复问题：${fixed.summary}` });
    }
    
    // 步骤5：发布
    return this.skills.publish.submit({
      files: code.files,
      description: this.composePRDescription(requirements, testResult, reviewResult),
    });
  }
}
```

这个结构的好处是：每个Skill可以独立开发、独立测试、独立迭代。TestSkill的负责人不需要关心ReviewSkill的实现。新增一个"安全扫描Skill"时，主Agent只需要在适当位置加入调用即可。

## 总结与最佳实践

设计Agent与Skill架构时，记住以下几点：

分层要清晰。Agent负责决策和调度，Skill负责执行和流程，工具层负责原子操作。不要让Agent直接操作工具，也不要让Skill做全局判断。

接口要契约化。每个Skill都要有明确的触发条件、输入规格、输出格式和边界约束。契约是Skill与Agent之间的信任基础。

扩展要预留。通过Skill注册、上下文策略、工具适配器和钩子系统四个扩展点，让系统能随需求生长而不需要推倒重来。

反模式要警惕。避免Skill膨胀、Agent包揽、接口过度设计、错误传播混乱和架构僵化。

演进要有节奏。不要一开始就设计完美的分层。先解决当前问题，等模式稳定后再抽象。过早抽象和过晚抽象都是问题。

最终目标是让系统像乐高积木一样：Agent是搭建者，Skill是积木块，工具层是连接件。积木块可以替换、可以增加，搭建者可以按不同方式组合，但每个部分都职责清晰、接口稳定。

这样的架构才能支撑AI系统从原型走向生产，从单一走向多元，从实验走向工程。
