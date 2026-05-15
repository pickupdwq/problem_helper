---
layout: ../../layouts/ArticleLayout.astro
title: "Skill间通信与协作模式详解"
lang: "zh-CN"
pubDate: 2025-11-05
updatedDate: 2025-11-05
description: "从消息传递、事件驱动、共享状态、管道模式、发布订阅、请求响应、异步协作和数据一致性八个维度，讲透Skill间通信与协作的完整方法论。"
author: "派"
tags: ["Skill通信", "协作模式", "消息传递", "系统设计"]
draft: false
---

现代AI系统很少由单个Skill独立完成所有工作。多个Skill需要协作：一个Skill生成代码，另一个Skill审查代码；一个Skill收集数据，另一个Skill分析数据。Skill之间的通信和协作模式，直接决定了系统的灵活性、可靠性和可维护性。这篇文章系统讲解八种核心协作模式。

## 消息传递：最基础的通信方式

消息传递是Skill之间通信的最基础形式。一个Skill发送消息，另一个Skill接收并处理。简单、直接、容易理解。

消息传递的核心是消息格式。好的消息格式应该自描述、类型安全、可扩展。自描述意味着消息包含足够信息，接收方不需要额外上下文就能理解。类型安全意味着消息结构固定，不会因为字段缺失或类型错误导致处理失败。可扩展意味着新增字段不会影响现有处理逻辑。

```typescript
interface SkillMessage {
  id: string;           // 消息唯一标识
  type: string;         // 消息类型，决定处理方式
  source: string;       // 发送方Skill ID
  target: string;       // 接收方Skill ID
  payload: unknown;     // 消息体
  timestamp: number;    // 发送时间
  correlationId?: string; // 关联ID，用于追踪请求链
}

// 示例：代码生成完成消息
const codeGenMessage: SkillMessage = {
  id: 'msg-001',
  type: 'code_generation.completed',
  source: 'code-gen-skill',
  target: 'code-review-skill',
  payload: {
    files: [
      { path: 'src/api/user.ts', content: '...' },
      { path: 'src/types/user.ts', content: '...' },
    ],
    metadata: {
      language: 'typescript',
      framework: 'express',
    },
  },
  timestamp: Date.now(),
  correlationId: 'task-123',
};
```

消息传递有两种模式：直接发送和通过中介。直接发送是Skill A直接调用Skill B的接口，简单但耦合度高。通过中介是Skill A把消息发到消息队列或事件总线，Skill B从那里订阅，解耦但增加复杂度。

```typescript
// 直接发送
class DirectMessaging {
  private skills = new Map<string, Skill>();

  register(skillId: string, skill: Skill): void {
    this.skills.set(skillId, skill);
  }

  async send(message: SkillMessage): Promise<void> {
    const target = this.skills.get(message.target);
    if (!target) {
      throw new Error(`Skill ${message.target} not found`);
    }
    await target.handleMessage(message);
  }
}

// 通过中介
class MessageBroker {
  private queues = new Map<string, SkillMessage[]>();
  private subscribers = new Map<string, Set<(msg: SkillMessage) => Promise<void>>>();

  async publish(message: SkillMessage): Promise<void> {
    const queue = this.queues.get(message.target) || [];
    queue.push(message);
    this.queues.set(message.target, queue);
    
    // 通知订阅者
    const subs = this.subscribers.get(message.target) || new Set();
    for (const handler of subs) {
      await handler(message);
    }
  }

  subscribe(target: string, handler: (msg: SkillMessage) => Promise<void>): void {
    const subs = this.subscribers.get(target) || new Set();
    subs.add(handler);
    this.subscribers.set(target, subs);
  }
}
```

选择哪种模式取决于系统规模和演化需求。小规模系统直接发送足够；大规模或需要动态扩展的系统应该通过中介。

## 事件驱动：松耦合的协作方式

事件驱动是消息传递的进阶形式。Skill之间不直接通信，而是通过事件总线发布和订阅事件。一个Skill完成工作后发布事件，感兴趣的Skill订阅并响应。

事件驱动的核心是：发布者不知道谁在处理事件，订阅者不知道事件从哪里来。这种松耦合让系统更灵活：新增Skill只需要订阅感兴趣的事件，不需要修改现有Skill。

```typescript
interface DomainEvent {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  source: string;
}

class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || new Set();
    handlers.add(handler);
    this.handlers.set(eventType, handlers);
  }

  off(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  async emit(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || new Set();
    await Promise.all(
      Array.from(handlers).map((handler) =>
        handler(event).catch((error) => {
          console.error(`Event handler failed for ${event.type}:`, error);
        })
      )
    );
  }
}

// 使用示例
const eventBus = new EventBus();

// 代码生成Skill发布事件
eventBus.emit({
  id: 'evt-001',
  type: 'code.generated',
  payload: { files: [...], language: 'typescript' },
  timestamp: Date.now(),
  source: 'code-gen-skill',
});

// 代码审查Skill订阅事件
eventBus.on('code.generated', async (event) => {
  const reviewSkill = new CodeReviewSkill();
  await reviewSkill.review(event.payload.files);
});

// 文档生成Skill也订阅同一事件
eventBus.on('code.generated', async (event) => {
  const docSkill = new DocGenSkill();
  await docSkill.generateDocs(event.payload.files);
});
```

事件驱动的挑战在于事件顺序和幂等性。如果事件处理有依赖顺序，需要额外机制保证。如果事件可能重复发送（比如网络重试），处理逻辑需要幂等：多次处理同一事件的结果与一次处理相同。

```typescript
interface IdempotentHandler {
  processedEvents: Set<string>;

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEvents.has(event.id)) {
      return; // 已处理过，直接返回
    }
    
    await this.doHandle(event);
    this.processedEvents.add(event.id);
  }
}
```

## 共享状态：直接的数据协作

有时Skill之间需要共享数据。比如一个Skill读取配置，另一个Skill修改配置，第三个Skill使用更新后的配置。这种场景下，共享状态比消息传递更自然。

共享状态的关键是访问控制。不是所有Skill都能读写所有状态。需要定义状态的属主、访问权限和更新规则。

```typescript
interface SharedState {
  namespace: string;
  data: Record<string, unknown>;
  version: number;
  lastModified: number;
  modifiedBy: string;
}

class StateManager {
  private states = new Map<string, SharedState>();
  private accessRules = new Map<string, AccessRule>();

  defineState(namespace: string, initialData: Record<string, unknown>): void {
    this.states.set(namespace, {
      namespace,
      data: initialData,
      version: 0,
      lastModified: Date.now(),
      modifiedBy: 'system',
    });
  }

  setAccessRule(namespace: string, rule: AccessRule): void {
    this.accessRules.set(namespace, rule);
  }

  async read(namespace: string, skillId: string, keys?: string[]): Promise<unknown> {
    const state = this.states.get(namespace);
    if (!state) throw new Error(`State ${namespace} not found`);
    
    const rule = this.accessRules.get(namespace);
    if (rule && !rule.read.includes(skillId)) {
      throw new Error(`Skill ${skillId} has no read access to ${namespace}`);
    }
    
    if (keys) {
      return keys.reduce((obj, key) => {
        obj[key] = state.data[key];
        return obj;
      }, {} as Record<string, unknown>);
    }
    return state.data;
  }

  async write(
    namespace: string,
    skillId: string,
    updates: Record<string, unknown>
  ): Promise<void> {
    const state = this.states.get(namespace);
    if (!state) throw new Error(`State ${namespace} not found`);
    
    const rule = this.accessRules.get(namespace);
    if (rule && !rule.write.includes(skillId)) {
      throw new Error(`Skill ${skillId} has no write access to ${namespace}`);
    }
    
    Object.assign(state.data, updates);
    state.version++;
    state.lastModified = Date.now();
    state.modifiedBy = skillId;
    
    // 通知订阅者
    await this.notifySubscribers(namespace, state);
  }
}
```

共享状态的挑战是并发冲突。两个Skill同时修改同一状态，后提交的会覆盖先提交的。解决方法有乐观锁、悲观锁和CRDT（无冲突复制数据类型）。

```typescript
// 乐观锁：版本号检查
async function updateWithOptimisticLock(
  stateManager: StateManager,
  namespace: string,
  skillId: string,
  updates: Record<string, unknown>,
  expectedVersion: number
): Promise<boolean> {
  const state = await stateManager.read(namespace, skillId);
  if (state.version !== expectedVersion) {
    return false; // 版本冲突，需要重试
  }
  await stateManager.write(namespace, skillId, updates);
  return true;
}
```

## 管道模式：数据流处理

管道模式是把多个Skill串联起来，前一个Skill的输出作为后一个Skill的输入。就像Unix管道的概念：cat file | grep pattern | sort | uniq。

管道模式适合数据流处理场景：数据从一个Skill流向下一个，每个Skill做一种转换。比如"收集数据 -> 清洗数据 -> 分析数据 -> 生成报告"。

```typescript
interface PipeStage {
  skill: Skill;
  config?: Record<string, unknown>;
}

class Pipeline {
  private stages: PipeStage[] = [];

  addStage(stage: PipeStage): Pipeline {
    this.stages.push(stage);
    return this;
  }

  async execute(input: unknown): Promise<unknown> {
    let data = input;
    
    for (const [index, stage] of this.stages.entries()) {
      try {
        data = await stage.skill.execute({
          input: data,
          config: stage.config,
          stage: index,
          totalStages: this.stages.length,
        });
      } catch (error) {
        throw new PipelineError(`Stage ${index} failed: ${error.message}`, index, error);
      }
    }
    
    return data;
  }
}

// 使用示例
const dataPipeline = new Pipeline()
  .addStage({ skill: new DataCollectionSkill(), config: { source: 'api' } })
  .addStage({ skill: new DataCleaningSkill(), config: { removeNulls: true } })
  .addStage({ skill: new DataAnalysisSkill(), config: { metrics: ['avg', 'max'] } })
  .addStage({ skill: new ReportGenerationSkill(), config: { format: 'markdown' } });

const report = await dataPipeline.execute({ query: 'sales-q3' });
```

管道模式的优势是清晰和可组合。每个Skill只做一件事，通过组合实现复杂流程。新增处理阶段只需在管道中添加一个节点。

挑战在于错误处理和中间状态。如果管道中途失败，前面阶段的结果可能已部分生效。需要设计回滚机制或补偿逻辑。

```typescript
interface CompensatablePipeline extends Pipeline {
  private compensations: Map<number, Compensation> = new Map();

  addStage(stage: PipeStage, compensation?: Compensation): CompensatablePipeline {
    super.addStage(stage);
    if (compensation) {
      this.compensations.set(this.stages.length - 1, compensation);
    }
    return this;
  }

  async execute(input: unknown): Promise<unknown> {
    const completedStages = [];
    
    try {
      let data = input;
      for (const [index, stage] of this.stages.entries()) {
        data = await stage.skill.execute({ input: data });
        completedStages.push(index);
      }
      return data;
    } catch (error) {
      // 回滚已完成的阶段
      for (const stageIndex of completedStages.reverse()) {
        const compensation = this.compensations.get(stageIndex);
        if (compensation) {
          await compensation.run();
        }
      }
      throw error;
    }
  }
}
```

## 发布订阅：一对多的通知

发布订阅（Pub/Sub）是事件驱动的特例。一个发布者，多个订阅者。发布者不关心谁订阅，订阅者不关心谁发布。

发布订阅适合广播场景：一个事件需要通知多个感兴趣的Skill。比如"代码提交"事件需要通知审查Skill、测试Skill、部署Skill。

```typescript
class PubSubSystem {
  private topics = new Map<string, Set<Subscriber>>();

  subscribe(topic: string, subscriber: Subscriber): Subscription {
    const subscribers = this.topics.get(topic) || new Set();
    subscribers.add(subscriber);
    this.topics.set(topic, subscribers);
    
    return {
      unsubscribe: () => {
        subscribers.delete(subscriber);
      },
    };
  }

  async publish(topic: string, message: unknown): Promise<void> {
    const subscribers = this.topics.get(topic) || new Set();
    await Promise.all(
      Array.from(subscribers).map((sub) =>
        sub.handle(message).catch((err) => {
          console.error(`Subscriber failed for ${topic}:`, err);
        })
      )
    );
  }
}

// 使用示例
const pubsub = new PubSubSystem();

// 多个Skill订阅代码提交事件
pubsub.subscribe('code.committed', codeReviewSkill);
pubsub.subscribe('code.committed', testSkill);
pubsub.subscribe('code.committed', deploySkill);

// 提交代码时发布事件
await pubsub.publish('code.committed', {
  commitId: 'abc123',
  author: 'developer',
  files: ['src/api.ts'],
});
```

发布订阅的挑战是消息保证和背压。如果订阅者处理慢，消息会堆积。需要设计流量控制：丢弃旧消息、限流或背压通知发布者减速。

## 请求响应：同步协作

有些场景需要同步协作：Skill A调用Skill B，等待B完成后继续。这种请求响应模式是最直观的协作方式。

请求响应的关键是超时和错误处理。Skill B可能迟迟不响应，Skill A不能无限等待。需要设置合理的超时时间，以及超时后的降级策略。

```typescript
interface RequestOptions {
  timeout: number;
  retries: number;
  fallback?: (error: Error) => Promise<unknown>;
}

class RequestResponseClient {
  async call(
    target: string,
    request: SkillMessage,
    options: RequestOptions
  ): Promise<unknown> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= options.retries; attempt++) {
      try {
        return await this.executeWithTimeout(target, request, options.timeout);
      } catch (error) {
        lastError = error;
        if (attempt < options.retries) {
          await this.delay(Math.pow(2, attempt) * 1000); // 指数退避
        }
      }
    }
    
    if (options.fallback) {
      return await options.fallback(lastError);
    }
    throw lastError;
  }

  private async executeWithTimeout(
    target: string,
    request: SkillMessage,
    timeout: number
  ): Promise<unknown> {
    return Promise.race([
      this.sendAndWait(target, request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ]);
  }
}

// 使用示例
const client = new RequestResponseClient();

const result = await client.call(
  'code-review-skill',
  {
    id: 'req-001',
    type: 'review.request',
    source: 'main-agent',
    target: 'code-review-skill',
    payload: { files: ['src/api.ts'] },
    timestamp: Date.now(),
  },
  {
    timeout: 30000,
    retries: 2,
    fallback: async () => ({ findings: [], error: 'Review service unavailable' }),
  }
);
```

请求响应的缺点是耦合度高：调用方需要知道被调用方的存在和接口。适合紧密协作的场景，不适合松耦合的系统。

## 异步协作：非阻塞的工作流

很多场景不需要立即得到结果。Skill A发起任务后可以继续做其他事情，等Skill B完成后再处理结果。这种异步协作提高系统吞吐量。

异步协作需要任务标识和回调机制。任务标识让Skill A能在稍后查询任务状态；回调机制让Skill B在完成后主动通知Skill A。

```typescript
interface AsyncTask {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: Error;
  createdAt: number;
  completedAt?: number;
}

class AsyncTaskManager {
  private tasks = new Map<string, AsyncTask>();
  private callbacks = new Map<string, (task: AsyncTask) => Promise<void>>();

  async submit(task: Omit<AsyncTask, 'status'>, callback?: (task: AsyncTask) => Promise<void>): Promise<string> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const asyncTask: AsyncTask = {
      ...task,
      id: taskId,
      status: 'pending',
      createdAt: Date.now(),
    };
    
    this.tasks.set(taskId, asyncTask);
    if (callback) {
      this.callbacks.set(taskId, callback);
    }
    
    return taskId;
  }

  async update(taskId: string, updates: Partial<AsyncTask>): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    Object.assign(task, updates);
    
    if (task.status === 'completed' || task.status === 'failed') {
      task.completedAt = Date.now();
      const callback = this.callbacks.get(taskId);
      if (callback) {
        await callback(task);
        this.callbacks.delete(taskId);
      }
    }
  }

  async getStatus(taskId: string): Promise<AsyncTask | undefined> {
    return this.tasks.get(taskId);
  }
}

// 使用示例
const taskManager = new AsyncTaskManager();

// Skill A提交异步任务
const taskId = await taskManager.submit(
  { type: 'code-analysis' },
  async (task) => {
    // 回调：Skill B完成后通知Skill A
    console.log(`Task ${task.id} completed with result:`, task.result);
  }
);

// Skill B处理任务
async function processTask(taskId: string) {
  await taskManager.update(taskId, { status: 'running' });
  try {
    const result = await analyzeCode();
    await taskManager.update(taskId, { status: 'completed', result });
  } catch (error) {
    await taskManager.update(taskId, { status: 'failed', error });
  }
}
```

## 数据一致性：分布式协作的保证

多个Skill协作时，数据一致性是核心挑战。一个Skill修改了数据，另一个Skill读取到的可能是旧值。分布式系统中，一致性、可用性和分区容错性不可兼得，需要根据场景做权衡。

强一致性要求所有Skill随时看到最新数据。实现方式是分布式锁或两阶段提交。代价是性能：每次读写都要协调，延迟增加。

最终一致性允许短暂不一致，但保证最终所有Skill看到相同数据。实现方式是异步复制和冲突解决。性能好，但需要处理冲突。

```typescript
// 最终一致性：异步复制
class EventuallyConsistentStore {
  private localStore = new Map<string, unknown>();
  private replicationQueue: ReplicationTask[] = [];

  async write(key: string, value: unknown): Promise<void> {
    this.localStore.set(key, value);
    this.replicationQueue.push({ key, value, timestamp: Date.now() });
    await this.replicate();
  }

  async read(key: string): Promise<unknown> {
    return this.localStore.get(key);
  }

  private async replicate(): Promise<void> {
    while (this.replicationQueue.length > 0) {
      const task = this.replicationQueue.shift();
      await this.sendToReplicas(task);
    }
  }
}

// 冲突解决：最后写入者胜
function resolveConflict(versions: VersionedValue[]): unknown {
  return versions.reduce((latest, current) => {
    return current.timestamp > latest.timestamp ? current : latest;
  }).value;
}
```

对于AI系统，最终一致性通常是更好的选择。因为Skill之间的协作通常是异步的，短暂的不一致可以接受。关键是设计好冲突解决策略和重试机制。

## 模式选择与组合

八种协作模式各有适用场景，也各有代价。实际系统中通常是多种模式组合使用。

简单直接的协作用请求响应。比如主Agent调用一个Skill完成特定任务，需要立即得到结果。

松耦合的协作用事件驱动或发布订阅。比如一个Skill完成工作后通知多个其他Skill，彼此不需要知道对方存在。

数据流处理用管道。比如数据经过多个阶段的转换，每个阶段一个Skill。

状态共享用共享状态加访问控制。比如多个Skill需要读写同一份配置或缓存。

长任务用异步协作。比如代码分析、测试运行等耗时操作，不应该阻塞主流程。

复杂工作流用状态机 orchestration。比如发布流程：构建 -> 测试 -> 审查 -> 部署，每个阶段可能用不同模式协作。

```typescript
class HybridOrchestrator {
  private eventBus = new EventBus();
  private taskManager = new AsyncTaskManager();
  private stateManager = new StateManager();

  async executeWorkflow(workflow: Workflow): Promise<void> {
    for (const step of workflow.steps) {
      switch (step.collaborationMode) {
        case 'sync':
          await this.executeSync(step);
          break;
        case 'async':
          await this.executeAsync(step);
          break;
        case 'event':
          await this.executeEventDriven(step);
          break;
        case 'pipeline':
          await this.executePipeline(step);
          break;
      }
    }
  }
}
```

## 总结与最佳实践

Skill间通信与协作的核心原则是：根据场景选择合适模式，不要追求统一；松耦合优于紧耦合，但松耦合有代价；最终一致性通常足够，但要有冲突解决策略。

具体最佳实践：

优先用事件驱动实现松耦合。Skill之间通过事件通信，不直接依赖。新增Skill只需订阅事件，不影响现有Skill。

管道模式处理数据流。数据转换类任务用管道串联，每个Skill只做一种转换，通过组合实现复杂流程。

共享状态加访问控制。需要共享数据时用状态管理器，明确定义读写权限，避免随意修改。

异步处理长任务。耗时操作不要阻塞主流程，用任务管理器跟踪状态，完成后回调或轮询。

设计补偿和回滚。多阶段协作中，如果中途失败，要有机制回滚已完成的阶段，避免部分成功的混乱状态。

监控协作链路。跟踪消息传递延迟、任务处理时间、错误率和重试次数。这些数据帮助发现瓶颈和优化点。

最终，好的协作模式让多个Skill像团队一样工作：各自负责擅长的部分，通过清晰的通信机制协调，共同完成复杂任务。模式不是目的，目的是让系统可靠、灵活、可维护。选择合适的模式，比使用高级模式更重要。
