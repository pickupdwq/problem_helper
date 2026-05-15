---
layout: ../../layouts/ArticleLayout.astro
title: "Skill中的Agent嵌套：深度集成指南"
lang: "zh-CN"
pubDate: 2025-10-22
updatedDate: 2025-10-22
description: "从嵌套场景、上下文传递、生命周期管理、通信机制、错误传播、性能影响和最佳实践七个维度，讲透Skill中嵌套Agent的完整方法论。"
author: "派"
tags: ["Agent嵌套", "Skill集成", "上下文管理", "高级用法"]
draft: false
---

现代AI系统越来越复杂，单个Agent难以处理所有任务。于是在Skill中嵌套Agent成为一种常见模式：外层Skill负责流程控制，内层Agent负责动态执行。但这种嵌套如果设计不好，会导致上下文爆炸、通信混乱、错误难追溯。这篇文章从七个维度，讲清楚Skill中嵌套Agent的正确方式。

## 什么场景需要嵌套

不是所有Skill都需要嵌套Agent。嵌套增加了复杂度，只有在收益明显时才应该使用。

适合嵌套的场景有四个特征：任务有不确定性、需要动态判断、可以并行处理、结果需要验证。

任务有不确定性意味着流程不能预先写死。比如"代码生成Skill"里，生成的代码是否正确需要Agent判断，不能按固定模板输出。外层Skill定义"生成函数X"，内层Agent负责具体实现。

需要动态判断意味着某些步骤的选择取决于中间结果。比如"数据处理Skill"中，数据格式可能是JSON、CSV或XML，解析方式不同。内层Agent根据实际格式选择解析策略，而不是Skill里穷举所有格式。

可以并行处理意味着多个子任务之间没有强依赖。比如"代码审查Skill"可以并行审查多个文件，每个文件由一个SubAgent处理，外层Skill汇总结果。

结果需要验证意味着执行后需要独立检查。比如"配置生成Skill"生成配置后，需要另一个Agent验证配置是否符合规范、是否有安全隐患。

不适合嵌套的场景也很明确：流程完全确定、没有分支判断、不需要探索、工具调用固定。这种场景直接用固定流程即可，嵌套Agent反而增加不必要的开销。

## 嵌套的三种模式

Skill中嵌套Agent有三种常见模式：委托模式、流水线模式和协作模式。

委托模式是外层Skill把完整子任务交给内层Agent，内层Agent独立完成后返回结果。外层Skill只负责触发和接收结果，不参与中间过程。这种模式适合边界清晰的子任务。

```typescript
// 委托模式示例
class CodeGenerationSkill implements Skill {
  async execute(params: SkillParams): Promise<SkillResult> {
    // 外层Skill准备上下文
    const context = {
      requirements: params.input.requirements,
      styleGuide: await this.loadStyleGuide(),
      existingCode: await this.loadRelatedFiles(params.input.scope),
    };
    
    // 委托给内层Agent
    const agent = new CodeGenAgent(context);
    const result = await agent.generate({
      target: params.input.targetFunction,
      constraints: params.input.constraints,
    });
    
    // 验证结果
    return this.validate(result);
  }
}
```

流水线模式是把任务拆成多个阶段，每个阶段由一个Agent处理，前一阶段的输出作为后一阶段的输入。外层Skill负责串联阶段、传递数据和处理阶段间的转换。

```typescript
// 流水线模式示例
class ArticlePipelineSkill implements Skill {
  private stages = [
    new ResearchAgent(),
    new OutlineAgent(),
    new DraftAgent(),
    new ReviewAgent(),
  ];

  async execute(params: SkillParams): Promise<SkillResult> {
    let data = { topic: params.input.topic };
    
    for (const [index, agent] of this.stages.entries()) {
      data = await agent.process(data, {
        stage: index,
        totalStages: this.stages.length,
      });
      
      // 阶段检查点
      if (data.blocked) {
        return { status: 'blocked', stage: index, reason: data.blockReason };
      }
    }
    
    return { status: 'completed', article: data.finalDraft };
  }
}
```

协作模式是多个Agent同时工作，相互通信协调。外层Skill提供共享上下文和通信机制，Agent之间交换信息、协商方案、解决冲突。这种模式最复杂，也最有力。

```typescript
// 协作模式示例
class CodeReviewCollaborativeSkill implements Skill {
  async execute(params: SkillParams): Promise<SkillResult> {
    const sharedContext = new SharedContext(params.input.files);
    
    const agents = [
      new SecurityReviewer(sharedContext),
      new PerformanceReviewer(sharedContext),
      new StyleReviewer(sharedContext),
    ];
    
    // 并行启动，共享发现
    await Promise.all(agents.map((agent) => agent.review()));
    
    // 协商冲突
    const conflicts = sharedContext.findConflicts();
    if (conflicts.length > 0) {
      await this.resolveConflicts(conflicts, agents);
    }
    
    return this.synthesize(sharedContext.getAllFindings());
  }
}
```

选择哪种模式取决于任务特性：边界清晰用委托，流程固定用流水线，需要协商用协作。

## 上下文传递：信息怎么流动

嵌套的最大挑战是上下文管理。外层Skill的上下文要不要传给内层Agent？传多少？怎么传？这些决定直接影响执行质量和成本。

上下文传递有三个原则：最小必要、结构化传递、增量更新。

最小必要原则只传内层Agent完成任务必需的信息。不要把外层Skill的全部上下文都塞进去，这会增加token消耗，稀释关键信息。比如内层Agent只需要知道"修改哪个函数"，不需要知道整个项目的历史。

```typescript
// 不好的做法：传递全部上下文
const result = await agent.execute({
  context: fullContext, // 可能包含几千token的无关信息
  task: '修复这个bug',
});

// 好的做法：只传递相关信息
const result = await agent.execute({
  context: {
    relevantFiles: ['src/utils.ts', 'src/types.ts'],
    errorMessage: params.error,
    expectedBehavior: params.expected,
  },
  task: '修复这个bug',
});
```

结构化传递原则是把上下文组织成Agent容易理解的格式。不要直接扔一段自然语言，而是用明确的字段名和组织结构。

```typescript
interface AgentContext {
  task: {
    goal: string;
    constraints: string[];
    successCriteria: string[];
  };
  background: {
    relevantFiles: FileInfo[];
    relatedCode: string;
    knownIssues: string[];
  };
  preferences: {
    codingStyle: string;
    namingConvention: string;
    errorHandling: string;
  };
}
```

增量更新原则是内层Agent执行过程中产生的中间结果，只把增量部分传回外层Skill，而不是重复完整上下文。外层Skill负责合并增量到全局上下文。

```typescript
class IncrementalContext {
  private baseContext: Context;
  private deltas: ContextDelta[] = [];

  addDelta(delta: ContextDelta): void {
    this.deltas.push(delta);
  }

  getFullContext(): Context {
    return this.deltas.reduce((ctx, delta) => {
      return this.applyDelta(ctx, delta);
    }, this.baseContext);
  }
}
```

## 生命周期管理：Agent何时创建和销毁

嵌套Agent不是永久存在的，它们有生命周期：创建、执行、暂停、恢复、销毁。管理不好会导致资源泄漏、状态混乱。

创建时机有两个选择：预创建和按需创建。预创建在Skill初始化时创建所有Agent，适合Agent数量固定、启动成本低的场景。按需创建在执行到需要时才创建，适合Agent数量不确定或启动成本高的场景。

销毁时机也有两个选择：立即销毁和延迟销毁。立即销毁在Agent完成任务后马上释放资源，适合无状态Agent。延迟销毁保留Agent一段时间，如果有类似任务可以复用，适合有状态Agent。

```typescript
interface AgentLifecycle {
  create(config: AgentConfig): Promise<Agent>;
  execute(agent: Agent, task: Task): Promise<Result>;
  pause(agent: Agent): Promise<PausedState>;
  resume(state: PausedState, newTask: Task): Promise<Result>;
  destroy(agent: Agent): Promise<void>;
}

class ManagedAgentPool implements AgentLifecycle {
  private pool = new Map<string, Agent>();
  private maxIdleTime = 300000; // 5分钟

  async acquire(skillId: string, config: AgentConfig): Promise<Agent> {
    // 尝试复用空闲Agent
    const existing = this.pool.get(skillId);
    if (existing && !this.isExpired(existing)) {
      return existing;
    }
    
    // 创建新Agent
    const agent = await this.create(config);
    this.pool.set(skillId, agent);
    return agent;
  }

  async release(agent: Agent): Promise<void> {
    // 不立即销毁，设置空闲计时器
    agent.idleSince = Date.now();
    this.scheduleCleanup(agent);
  }

  private scheduleCleanup(agent: Agent): void {
    setTimeout(() => {
      if (Date.now() - agent.idleSince > this.maxIdleTime) {
        this.destroy(agent);
      }
    }, this.maxIdleTime);
  }
}
```

生命周期管理还要考虑异常情况的清理。如果外层Skill突然终止，内层Agent可能还在执行。需要确保资源被正确释放，不会留下孤儿进程或锁。

## 通信机制：Skill与Agent怎么对话

外层Skill和内层Agent之间需要通信。通信方式决定了协作效率和灵活性。

通信有三种粒度：单次调用、流式交互和双向对话。

单次调用是最简单的：Skill给Agent一个任务，Agent返回结果，通信结束。适合明确、独立的子任务。

流式交互是Agent在执行过程中持续输出中间结果，Skill可以实时观察进度。适合长时间运行的任务，比如代码生成或数据分析。

```typescript
class StreamingSkill implements Skill {
  async execute(params: SkillParams): Promise<SkillResult> {
    const agent = new StreamingAgent();
    const results = [];
    
    for await (const chunk of agent.executeStreaming(params.input)) {
      // 实时处理中间结果
      if (chunk.type === 'progress') {
        this.reportProgress(chunk.percentage);
      } else if (chunk.type === 'intermediate') {
        results.push(chunk.data);
      } else if (chunk.type === 'question') {
        // Agent需要更多信息
        const answer = await this.askUser(chunk.question);
        agent.provideAnswer(answer);
      }
    }
    
    return this.synthesize(results);
  }
}
```

双向对话是最灵活的：Skill和Agent可以多次交互，Agent可以提问、请求澄清、报告问题。适合复杂、开放的任务。

```typescript
class ConversationalSkill implements Skill {
  async execute(params: SkillParams): Promise<SkillResult> {
    const agent = new ConversationalAgent();
    let turn = 0;
    const maxTurns = 10;
    
    while (turn < maxTurns) {
      const response = await agent.act(this.currentContext);
      
      if (response.type === 'complete') {
        return response.result;
      } else if (response.type === 'question') {
        const answer = await this.resolveQuestion(response.question);
        this.currentContext.addMessage('skill', answer);
      } else if (response.type === 'action') {
        const actionResult = await this.executeAction(response.action);
        this.currentContext.addMessage('skill', `Action result: ${actionResult}`);
      }
      
      turn++;
    }
    
    throw new Error('Max turns exceeded');
  }
}
```

选择通信方式要考虑任务特性和用户体验。简单任务用单次调用，长时间任务用流式，复杂协商用双向对话。

## 错误传播：失败时怎么办

嵌套结构中的错误传播比单层更复杂。内层Agent的错误需要被外层Skill正确理解、处理和恢复。

错误传播有三个层面：捕获、转换和恢复。

捕获是指外层Skill要能捕获内层Agent的所有错误，包括同步错误和异步错误。不能假设Agent永远成功。

转换是指把Agent特定的错误转换为Skill标准错误。Agent可能抛出各种错误，但Skill对外应该暴露统一的错误类型。

```typescript
class ErrorTranslator {
  translate(agentError: AgentError): SkillError {
    switch (agentError.code) {
      case 'CONTEXT_OVERFLOW':
        return new SkillError('context_exceeded', '上下文超出限制，请简化任务');
      case 'TOOL_FAILURE':
        return new SkillError('dependency_missing', `工具调用失败: ${agentError.toolName}`);
      case 'TIMEOUT':
        return new SkillError('timeout', '任务执行超时');
      case 'INVALID_OUTPUT':
        return new SkillError('execution_failed', 'Agent输出格式错误');
      default:
        return new SkillError('unknown', agentError.message);
    }
  }
}
```

恢复是指根据错误类型采取不同策略。可恢复错误应该重试或降级，不可恢复错误应该上报用户。

```typescript
interface RecoveryStrategy {
  canRecover(error: SkillError): boolean;
  recover(error: SkillError, context: ExecutionContext): Promise<RecoveryResult>;
}

class RetryStrategy implements RecoveryStrategy {
  constructor(private maxRetries: number, private backoff: number) {}

  canRecover(error: SkillError): boolean {
    return error.recoverable && error.attempt < this.maxRetries;
  }

  async recover(error: SkillError, context: ExecutionContext): Promise<RecoveryResult> {
    await sleep(this.backoff * Math.pow(2, error.attempt));
    return { action: 'retry', context };
  }
}

class DegradeStrategy implements RecoveryStrategy {
  canRecover(error: SkillError): boolean {
    return error.type === 'timeout' || error.type === 'context_exceeded';
  }

  async recover(error: SkillError, context: ExecutionContext): Promise<RecoveryResult> {
    const simplifiedTask = this.simplify(context.task);
    return { action: 'degrade', context: { ...context, task: simplifiedTask } };
  }
}
```

错误传播还要考虑级联失败。如果一个内层Agent失败，是否影响其他Agent？在流水线模式中，通常需要停止；在协作模式中，可能允许其他Agent继续。

## 性能影响：嵌套的成本

嵌套Agent不是没有成本的。每次嵌套都意味着额外的LLM调用、上下文传输和结果解析。在复杂嵌套结构中，这些成本会叠加。

主要成本来源有四个：启动开销、上下文传输、串行等待和重复计算。

启动开销是创建Agent的固定成本。包括加载配置、初始化上下文、建立连接。频繁的创建销毁会增加这部分开销。

上下文传输是把外层上下文传给内层的token成本。如果外层上下文很大，每次嵌套都要复制一份，token消耗会成倍增长。

串行等待是流水线模式中前一阶段完成后才能开始后一阶段。如果每个阶段都很慢，总延迟是各阶段之和。

重复计算是多个Agent独立做相同的事情，比如都读取同一个配置文件。没有共享缓存时，这种重复不可避免。

优化策略包括：Agent池化复用、上下文裁剪、并行执行和结果缓存。

```typescript
// Agent池化
class AgentPool {
  private agents = new Map<string, Agent[]>();
  
  async acquire(skillId: string): Promise<Agent> {
    const pool = this.agents.get(skillId) || [];
    const available = pool.find((a) => a.status === 'idle');
    if (available) {
      available.status = 'busy';
      return available;
    }
    // 创建新Agent
    const agent = await this.createAgent(skillId);
    pool.push(agent);
    this.agents.set(skillId, pool);
    return agent;
  }
}

// 上下文裁剪
function pruneContext(context: Context, relevance: number): Context {
  return {
    ...context,
    history: context.history.filter((item) => item.relevance >= relevance),
    files: context.files.filter((file) => file.relevance >= relevance),
  };
}

// 结果缓存
class ResultCache {
  private cache = new Map<string, CacheEntry>();
  
  get(key: string): unknown | undefined {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.time < entry.ttl) {
      return entry.value;
    }
    return undefined;
  }
}
```

## 最佳实践建议

基于以上七个维度的分析，这里总结六条实践建议。

第一，嵌套深度不超过三层。超过三层后，上下文管理、错误传播和性能优化都会变得极其困难。如果确实需要更深嵌套，考虑重构为多个独立Skill协作。

第二，每个嵌套Agent的任务必须在100字内描述清楚。如果描述不清楚，说明任务边界模糊，不适合嵌套。边界清晰的任务才能被独立执行和验证。

第三，外层Skill必须定义明确的完成标准。内层Agent什么时候算完成？输出什么格式？达到什么质量？没有完成标准的嵌套Agent容易过度执行或过早停止。

第四，建立统一的上下文协议。所有Agent使用相同的上下文格式，包括字段名、数据类型和编码方式。统一的协议降低集成成本，也便于工具化。

第五，嵌套Agent的输出必须可验证。外层Skill应该能独立验证内层Agent的结果，而不是盲目信任。可验证的输出包括：结构化数据、引用来源、执行日志。

第六，监控嵌套结构的性能指标。包括：嵌套深度分布、Agent调用次数、上下文大小、执行延迟、错误率。这些数据帮助发现性能瓶颈和架构问题。

```typescript
interface NestingMetrics {
  skillId: string;
  executionId: string;
  nestingDepth: number;
  agentCalls: AgentCallMetrics[];
  totalDuration: number;
  totalTokens: number;
  errorCount: number;
}

interface AgentCallMetrics {
  agentId: string;
  startTime: number;
  endTime: number;
  inputTokens: number;
  outputTokens: number;
  success: boolean;
}
```

Skill中的Agent嵌套是一把双刃剑。用得好，可以让系统既有流程的稳定性，又有执行的灵活性；用得不好，会让系统变得复杂、脆弱、难以维护。关键是理解每种嵌套模式的适用场景，建立清晰的上下文传递和错误处理机制，并持续监控和优化性能。当你的Skill需要在确定性流程中处理不确定性任务时，嵌套Agent就是正确的工具。
