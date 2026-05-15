---
layout: ../../layouts/ArticleLayout.astro
title: "Agent高级用法：上下文管理与状态持久化"
lang: "zh-CN"
pubDate: 2025-10-29
updatedDate: 2025-10-29
description: "从上下文窗口优化、状态机设计、记忆机制、长期存储、会话恢复、上下文压缩和多轮对话管理七个维度，讲透Agent高级用法的核心方法。"
author: "派"
tags: ["Agent高级用法", "上下文管理", "状态持久化", "AI系统"]
draft: false
---

Agent不是无状态的问答机器。一个有用的Agent需要记住用户偏好、跟踪任务进度、维护工作上下文、在会话中断后恢复状态。这些能力统称为上下文管理与状态持久化。掌握它们，才能把Agent从玩具变成工具。

## 上下文窗口的本质限制

当前主流模型的上下文窗口虽然越来越大，但"能装"不等于"能处理"。模型对长上下文的注意力会稀释，关键信息可能被淹没在大量无关内容中。

上下文窗口的问题不是容量，而是质量。塞满上下文的Agent表现往往不如只给关键信息的Agent。因为模型需要在大量信息中找到相关部分，这个过程本身消耗认知资源。

影响上下文质量的三个因素：信息密度、组织结构和时效性。

信息密度是指上下文中有效信息的比例。一段完整的对话历史可能包含大量寒暄、重复确认和无关讨论，信息密度很低。需要定期清理和压缩。

组织结构是指信息是否有清晰的层次和关联。散乱的上下文让模型难以建立正确的关联，结构化的上下文则帮助模型快速定位。

时效性是指信息是否仍然相关。过时的信息不仅没用，还会干扰判断。比如三天前的临时决定，今天可能已经变了。

## 上下文窗口优化策略

优化上下文窗口有四个策略：窗口滑动、语义分块、层级组织和主动遗忘。

窗口滑动是只保留最近N轮对话。这是最简单的策略，适合短期任务。缺点是可能丢失关键背景信息，特别是背景信息出现在较早的对话中。

```typescript
class SlidingWindowContext {
  private history: Message[] = [];
  private maxMessages: number;

  add(message: Message): void {
    this.history.push(message);
    if (this.history.length > this.maxMessages) {
      this.history.shift();
    }
  }

  getContext(): Message[] {
    return this.history;
  }
}
```

语义分块是按主题或任务把上下文分成独立块。每个块有明确的主题标识，Agent根据当前任务选择相关块。这比滑动窗口更精确，因为保留了历史信息，只是按需加载。

```typescript
interface ContextChunk {
  id: string;
  topic: string;
  messages: Message[];
  relevance: number;
  lastAccessed: number;
}

class SemanticContext {
  private chunks: Map<string, ContextChunk> = new Map();

  add(message: Message, topic: string): void {
    const chunk = this.chunks.get(topic) || {
      id: topic,
      topic,
      messages: [],
      relevance: 1.0,
      lastAccessed: Date.now(),
    };
    chunk.messages.push(message);
    chunk.lastAccessed = Date.now();
    this.chunks.set(topic, chunk);
  }

  getRelevant(query: string, topK: number = 3): ContextChunk[] {
    return Array.from(this.chunks.values())
      .sort((a, b) => this.calculateRelevance(b, query) - this.calculateRelevance(a, query))
      .slice(0, topK);
  }
}
```

层级组织是把上下文分为不同层级：系统级（全局规则）、会话级（当前对话历史）、任务级（当前任务的特定信息）。不同层级有不同的保留策略和更新频率。

```typescript
interface HierarchicalContext {
  system: {
    rules: string[];
    preferences: Record<string, unknown>;
  };
  session: {
    history: Message[];
    summary: string;
  };
  task: {
    currentGoal: string;
    progress: TaskProgress;
    artifacts: Record<string, unknown>;
  };
}
```

主动遗忘是定期清理不再需要的信息。不是被动等窗口满了再删，而是主动判断哪些信息已经过时或不再相关。

```typescript
class ActiveForgetting {
  private context: Context;
  private retentionRules: RetentionRule[];

  async cleanup(): Promise<void> {
    for (const item of this.context.items) {
      const shouldKeep = await this.evaluateRetention(item);
      if (!shouldKeep) {
        this.context.remove(item.id);
      }
    }
  }

  private async evaluateRetention(item: ContextItem): Promise<boolean> {
    for (const rule of this.retentionRules) {
      const result = await rule.evaluate(item);
      if (result === 'keep') return true;
      if (result === 'discard') return false;
    }
    return true; // 默认保留
  }
}
```

## 状态机设计：Agent的状态管理

复杂任务不是线性的。Agent需要在不同状态间转换：理解需求、收集信息、制定方案、执行操作、验证结果。状态机是管理这种复杂性的有效工具。

Agent的状态机包含三个要素：状态定义、转换条件和执行动作。

状态定义要明确每个状态的含义和进入退出条件。常见状态包括：idle（空闲）、understanding（理解需求）、gathering（收集信息）、planning（制定计划）、executing（执行）、verifying（验证）、completed（完成）、blocked（阻塞）。

转换条件定义什么事件触发状态变化。比如从understanding到gathering的转换条件是"需求理解完成，但信息不足"。

执行动作定义进入状态时要做什么。比如进入executing状态时，Agent开始调用工具执行计划。

```typescript
interface State {
  id: string;
  onEnter?: (ctx: AgentContext) => Promise<void>;
  onExit?: (ctx: AgentContext) => Promise<void>;
  transitions: Transition[];
}

interface Transition {
  target: string;
  condition: (ctx: AgentContext) => boolean;
  action?: (ctx: AgentContext) => Promise<void>;
}

class AgentStateMachine {
  private states = new Map<string, State>();
  private currentState: string = 'idle';

  defineState(state: State): void {
    this.states.set(state.id, state);
  }

  async handleEvent(event: AgentEvent): Promise<void> {
    const state = this.states.get(this.currentState);
    if (!state) return;

    for (const transition of state.transitions) {
      if (transition.condition(this.context)) {
        if (state.onExit) await state.onExit(this.context);
        if (transition.action) await transition.action(this.context);
        this.currentState = transition.target;
        const newState = this.states.get(transition.target);
        if (newState?.onEnter) await newState.onEnter(this.context);
        return;
      }
    }
  }
}

// 定义一个代码生成Agent的状态机
const codeGenStates: State[] = [
  {
    id: 'idle',
    transitions: [
      { target: 'understanding', condition: (ctx) => ctx.hasNewTask() },
    ],
  },
  {
    id: 'understanding',
    onEnter: async (ctx) => await ctx.analyzeRequirements(),
    transitions: [
      { target: 'gathering', condition: (ctx) => ctx.needsMoreInfo() },
      { target: 'planning', condition: (ctx) => ctx.requirementsClear() },
    ],
  },
  {
    id: 'gathering',
    onEnter: async (ctx) => await ctx.askQuestions(),
    transitions: [
      { target: 'planning', condition: (ctx) => ctx.infoSufficient() },
    ],
  },
  {
    id: 'planning',
    onEnter: async (ctx) => await ctx.createPlan(),
    transitions: [
      { target: 'executing', condition: (ctx) => ctx.planApproved() },
      { target: 'understanding', condition: (ctx) => ctx.planRejected() },
    ],
  },
  {
    id: 'executing',
    onEnter: async (ctx) => await ctx.executePlan(),
    transitions: [
      { target: 'verifying', condition: (ctx) => ctx.executionComplete() },
      { target: 'blocked', condition: (ctx) => ctx.executionFailed() },
    ],
  },
  {
    id: 'verifying',
    onEnter: async (ctx) => await ctx.verifyResult(),
    transitions: [
      { target: 'completed', condition: (ctx) => ctx.verificationPassed() },
      { target: 'executing', condition: (ctx) => ctx.needsFix() },
    ],
  },
  {
    id: 'blocked',
    onEnter: async (ctx) => await ctx.reportBlockage(),
    transitions: [
      { target: 'executing', condition: (ctx) => ctx.blockageResolved() },
      { target: 'completed', condition: (ctx) => ctx.userAborted() },
    ],
  },
  {
    id: 'completed',
    onEnter: async (ctx) => await ctx.deliverResult(),
    transitions: [
      { target: 'idle', condition: () => true },
    ],
  },
];
```

状态机的价值在于：Agent行为可预测、可调试、可恢复。每个状态有明确的职责，状态转换有明确的条件，不会在执行过程中迷失方向。

## 记忆机制：短期记忆与长期记忆

人类有两种记忆：短期记忆（工作记忆）和长期记忆。Agent也需要类似机制。

短期记忆是当前会话中的上下文，包括对话历史、任务状态、中间结果。短期记忆的特点是容量有限、访问快速、会话结束即消失。

长期记忆是跨会话保持的信息，包括用户偏好、项目知识、历史决策。长期记忆的特点是容量大、持久保存、需要主动检索。

两种记忆的实现方式不同。短期记忆通常保存在内存中，直接作为prompt的一部分传给模型。长期记忆需要外部存储，并在需要时检索相关片段。

```typescript
interface Memory {
  shortTerm: ShortTermMemory;
  longTerm: LongTermMemory;
}

class ShortTermMemory {
  private items: MemoryItem[] = [];
  private maxItems = 20;

  add(item: MemoryItem): void {
    this.items.push(item);
    if (this.items.length > this.maxItems) {
      this.items.shift();
    }
  }

  getAll(): MemoryItem[] {
    return this.items;
  }
}

class LongTermMemory {
  private store: VectorStore;

  async remember(item: MemoryItem): Promise<void> {
    const embedding = await this.embed(item.content);
    await this.store.add({
      id: item.id,
      content: item.content,
      embedding,
      metadata: item.metadata,
    });
  }

  async recall(query: string, limit: number = 5): Promise<MemoryItem[]> {
    const queryEmbedding = await this.embed(query);
    const results = await this.store.search(queryEmbedding, limit);
    return results.map((r) => ({
      id: r.id,
      content: r.content,
      metadata: r.metadata,
    }));
  }
}
```

长期记忆的检索是关键。不是所有长期记忆都需要加载，只加载与当前任务相关的。相关性的判断通常基于向量相似度：把查询和记忆都转成向量，计算相似度，取最相关的几个。

```typescript
async function retrieveRelevantMemories(
  query: string,
  longTermMemory: LongTermMemory,
  options: RetrievalOptions
): Promise<MemoryItem[]> {
  // 1. 向量检索
  const vectorResults = await longTermMemory.recall(query, options.vectorLimit);
  
  // 2. 时间过滤
  const timeFiltered = vectorResults.filter(
    (item) => Date.now() - item.metadata.timestamp < options.maxAge
  );
  
  // 3. 重要性过滤
  const important = timeFiltered.filter(
    (item) => item.metadata.importance >= options.minImportance
  );
  
  // 4. 去重和排序
  return deduplicateAndSort(important);
}
```

## 长期存储：状态怎么持久化

Agent状态需要在会话之间持久化。用户可能今天提了一个需求，明天继续讨论；Agent可能中途崩溃，需要恢复。没有持久化，每次会话都是新的开始。

需要持久化的状态包括：用户偏好、任务历史、项目知识、执行日志、中间产物。

持久化策略取决于数据特性和访问模式。用户偏好变化少，可以全量保存；任务历史变化多，可以增量追加；项目知识体积大，需要向量化存储。

```typescript
interface PersistenceLayer {
  // 用户偏好：少量、结构化、经常读取
  preferences: {
    get(userId: string): Promise<UserPreferences>;
    set(userId: string, prefs: UserPreferences): Promise<void>;
  };

  // 任务历史：大量、时序、按需读取
  taskHistory: {
    append(taskId: string, event: TaskEvent): Promise<void>;
    getRecent(userId: string, limit: number): Promise<TaskSummary[]>;
  };

  // 项目知识：大量、非结构化、语义检索
  projectKnowledge: {
    index(projectId: string, documents: Document[]): Promise<void>;
    search(projectId: string, query: string): Promise<SearchResult[]>;
  };
}

class FilePersistence implements PersistenceLayer {
  private basePath: string;

  async saveState(agentId: string, state: AgentState): Promise<void> {
    const path = `${this.basePath}/${agentId}/state.json`;
    await fs.writeFile(path, JSON.stringify(state, null, 2));
  }

  async loadState(agentId: string): Promise<AgentState | null> {
    const path = `${this.basePath}/${agentId}/state.json`;
    try {
      const data = await fs.readFile(path, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}
```

持久化还要考虑版本兼容性。Agent实现可能升级，状态结构可能变化。老状态需要能迁移到新结构，否则升级后状态就丢了。

```typescript
interface StateMigration {
  fromVersion: number;
  toVersion: number;
  migrate(oldState: unknown): AgentState;
}

class StateManager {
  private migrations: StateMigration[] = [];

  registerMigration(migration: StateMigration): void {
    this.migrations.push(migration);
  }

  async loadAndMigrate(agentId: string): Promise<AgentState> {
    const raw = await this.persistence.loadState(agentId);
    if (!raw) return this.createInitialState();
    
    let state = raw;
    const currentVersion = this.getCurrentVersion();
    
    while (state.version < currentVersion) {
      const migration = this.migrations.find(
        (m) => m.fromVersion === state.version
      );
      if (!migration) {
        throw new Error(`No migration found for version ${state.version}`);
      }
      state = migration.migrate(state);
    }
    
    return state;
  }
}
```

## 会话恢复：断点续传

会话中断是常态。网络波动、系统重启、用户离开，都会导致Agent会话中断。好的Agent应该能在恢复后从中断点继续，而不是重新开始。

会话恢复需要三个要素：检查点、状态快照和恢复逻辑。

检查点是执行过程中的保存点。在关键步骤完成后保存状态，如果后续失败可以从这里恢复，而不是从头再来。

```typescript
interface Checkpoint {
  id: string;
  timestamp: number;
  state: AgentState;
  completedSteps: string[];
  pendingSteps: string[];
}

class CheckpointManager {
  private checkpoints: Checkpoint[] = [];

  async save(state: AgentState, completedSteps: string[]): Promise<void> {
    const checkpoint: Checkpoint = {
      id: `cp-${Date.now()}`,
      timestamp: Date.now(),
      state: structuredClone(state),
      completedSteps: [...completedSteps],
      pendingSteps: this.calculatePending(state),
    };
    this.checkpoints.push(checkpoint);
    await this.persistence.saveCheckpoint(checkpoint);
  }

  async restore(latest: boolean = true): Promise<AgentState> {
    const checkpoint = latest
      ? this.checkpoints[this.checkpoints.length - 1]
      : await this.findLastValidCheckpoint();
    
    if (!checkpoint) {
      throw new Error('No checkpoint available');
    }
    
    return checkpoint.state;
  }
}
```

状态快照是Agent完整状态的序列化表示。包括当前状态机状态、上下文内容、记忆数据、执行计划。快照要足够完整，让恢复后的Agent行为与中断前一致。

恢复逻辑决定恢复后做什么。简单恢复是回到检查点继续执行。智能恢复是评估中断期间是否有变化（比如用户改了文件），如果有变化则调整计划再执行。

```typescript
class SessionRecovery {
  async recover(sessionId: string): Promise<RecoveryResult> {
    // 1. 加载最后状态
    const state = await this.stateManager.loadState(sessionId);
    
    // 2. 检测环境变化
    const changes = await this.detectChanges(state);
    
    // 3. 决定恢复策略
    if (changes.length === 0) {
      // 无变化，直接继续
      return { action: 'resume', state };
    } else if (changes.every((c) => c.type === 'additive')) {
      // 只有新增，可以安全继续
      return { action: 'resume', state };
    } else {
      // 有破坏性变化，需要重新规划
      const replanned = await this.replan(state, changes);
      return { action: 'replan', state: replanned };
    }
  }

  private async detectChanges(state: AgentState): Promise<Change[]> {
    const changes = [];
    for (const file of state.trackedFiles) {
      const currentHash = await this.computeHash(file.path);
      if (currentHash !== file.hash) {
        changes.push({ type: 'modified', path: file.path });
      }
    }
    return changes;
  }
}
```

## 上下文压缩：长上下文的生存策略

当上下文不可避免地变长时，压缩是必要的。压缩的目标是在保留关键信息的前提下，减少token数量。

压缩策略分为三个层次：摘要、提取和丢弃。

摘要是对长内容进行概括。对话历史可以总结成一段要点，代码文件可以总结成接口和关键逻辑，文档可以总结成章节大纲。

```typescript
class ContextCompressor {
  async compress(messages: Message[], targetTokens: number): Promise<Message[]> {
    let current = messages;
    
    while (this.estimateTokens(current) > targetTokens) {
      // 1. 尝试摘要最旧的对话
      if (current.length > 10) {
        const summary = await this.summarize(current.slice(0, -5));
        current = [summary, ...current.slice(-5)];
        continue;
      }
      
      // 2. 尝试提取关键信息
      const extracted = await this.extractKeyInfo(current);
      if (extracted.length < current.length) {
        current = extracted;
        continue;
      }
      
      // 3. 丢弃最低优先级内容
      current = this.dropLowestPriority(current);
    }
    
    return current;
  }

  private async summarize(messages: Message[]): Promise<Message> {
    const summary = await this.llm.complete(
      `Summarize the following conversation in 3-5 bullet points:\n\n${messages.map((m) => `${m.role}: ${m.content}`).join('\n')}`
    );
    return { role: 'system', content: `Previous conversation summary:\n${summary}` };
  }
}
```

提取是只保留关键片段。比如代码审查时，不需要保留整个文件内容，只保留被修改的函数和相关的上下文行。

丢弃是按优先级移除内容。每个上下文片段应该有优先级评分，低优先级的先丢弃。优先级可以根据：信息新鲜度、与当前任务的相关性、用户显式标记的重要性。

```typescript
function calculatePriority(item: ContextItem, currentTask: string): number {
  const age = Date.now() - item.timestamp;
  const ageScore = Math.max(0, 1 - age / (24 * 3600 * 1000)); // 24小时内满分
  
  const relevanceScore = calculateRelevance(item.content, currentTask);
  
  const importanceScore = item.importance || 0.5;
  
  return ageScore * 0.3 + relevanceScore * 0.5 + importanceScore * 0.2;
}
```

## 多轮对话管理

Agent与用户的交互通常是多轮对话。管理好多轮对话的状态和上下文，是Agent好用的关键。

多轮对话的挑战在于：用户可能在任何一轮改变意图、补充信息、纠正错误；Agent需要在长对话中保持连贯性，不重复提问，不遗忘已确认的信息。

管理多轮对话有三个机制：意图追踪、信息槽位和对话策略。

意图追踪是识别用户每轮输入的真实意图。用户说"改成红色"，意图是修改颜色属性；用户说"不对，我要蓝色"，意图是纠正上一轮的选择。

```typescript
interface Intent {
  type: 'create' | 'modify' | 'delete' | 'query' | 'confirm' | 'correct' | 'abort';
  target?: string;
  parameters: Record<string, unknown>;
  confidence: number;
}

class IntentTracker {
  private history: Intent[] = [];

  async parse(input: string, context: AgentContext): Promise<Intent> {
    const prompt = `
      Based on the conversation history and current input, determine the user's intent.
      
      History: ${JSON.stringify(this.history.slice(-3))}
      Current input: ${input}
      
      Respond with JSON: { "type": "...", "target": "...", "parameters": {...}, "confidence": 0.0-1.0 }
    `;
    
    const result = await this.llm.complete(prompt);
    return JSON.parse(result);
  }
}
```

信息槽位是收集完成任务所需的信息片段。比如预订餐厅需要：日期、时间、人数、偏好。每轮对话收集或更新一个或多个槽位。

```typescript
interface Slot {
  name: string;
  value: unknown;
  status: 'empty' | 'filled' | 'confirmed' | 'ambiguous';
  source?: string; // 哪一轮对话填充的
}

class SlotManager {
  private slots: Map<string, Slot> = new Map();

  defineSlot(name: string): void {
    this.slots.set(name, { name, value: null, status: 'empty' });
  }

  fill(name: string, value: unknown, source: string): void {
    const slot = this.slots.get(name);
    if (slot) {
      slot.value = value;
      slot.status = 'filled';
      slot.source = source;
    }
  }

  confirm(name: string): void {
    const slot = this.slots.get(name);
    if (slot) slot.status = 'confirmed';
  }

  getMissing(): string[] {
    return Array.from(this.slots.values())
      .filter((s) => s.status !== 'confirmed')
      .map((s) => s.name);
  }
}
```

对话策略是决定Agent下一轮说什么。策略可以是：如果信息不全，继续提问；如果信息完整，执行任务；如果有歧义，请求澄清；如果用户纠正，更新槽位。

```typescript
interface DialoguePolicy {
  decide(context: AgentContext): DialogueAction;
}

class InformationGatheringPolicy implements DialoguePolicy {
  decide(context: AgentContext): DialogueAction {
    const missing = context.slots.getMissing();
    
    if (missing.length > 0) {
      return {
        type: 'ask',
        slot: missing[0],
        message: this.generateQuestion(missing[0]),
      };
    }
    
    if (context.slots.hasAmbiguous()) {
      return {
        type: 'clarify',
        message: this.generateClarification(),
      };
    }
    
    return {
      type: 'execute',
      message: '信息已收集完整，开始执行...',
    };
  }
}
```

## 总结与最佳实践

上下文管理与状态持久化是Agent从玩具到工具的必经之路。没有它们，Agent只能处理单次、独立、简短的任务；有了它们，Agent才能处理复杂、持续、长周期的任务。

关键的最佳实践包括：

上下文优化是持续过程。不要指望一次设计好就永远适用。随着任务复杂度增加，需要不断调整上下文策略：从滑动窗口到语义分块，从简单摘要到智能压缩。

状态机让行为可预测。即使不使用完整的状态机框架，也应该为Agent定义清晰的状态和转换条件。这帮助调试，也帮助恢复。

记忆分层提高效率。短期记忆处理当前会话，长期记忆保留跨会话知识。不要什么信息都塞进prompt，该存外部的存外部，该检索时再检索。

持久化考虑版本。状态结构会变化，持久化格式要支持迁移。否则升级一次Agent就丢失所有历史状态。

恢复要智能。不是简单回到中断点，而是评估环境变化后决定是继续、重试还是重新规划。

压缩要有策略。摘要、提取、丢弃三层策略结合使用，根据信息类型选择合适的方法。

对话管理用槽位。把多轮对话看作信息收集过程，用槽位跟踪进度，用策略决定下一步行动。

最终，好的上下文管理让用户感觉不到Agent有"上下文"这个概念。Agent自然记得用户偏好，自然能从上次中断的地方继续，自然不会在长对话中迷失。当这些成为默认行为时，Agent才真正可用。
