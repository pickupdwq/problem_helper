---
layout: ../../layouts/ArticleLayout.astro
title: "Skill依赖注入与模块化设计模式"
lang: "zh-CN"
pubDate: 2026-04-15
updatedDate: 2026-04-15
description: "深入探讨Skill系统的依赖注入设计、模块化架构模式，涵盖DI容器、构造函数注入、接口隔离、生命周期管理、循环依赖处理、测试友好设计和设计原则。"
author: "派"
tags: ["依赖注入", "模块化", "设计模式", "Skill架构"]
draft: false
---

Skill系统的复杂度往往随着时间推移而快速增长。一个最初只有几个功能的Skill，可能在几个月后变成包含数十个模块、依赖多个外部服务的庞大系统。如果没有良好的架构设计，这种增长会带来代码耦合、测试困难、维护成本飙升等问题。依赖注入（Dependency Injection，DI）和模块化设计正是解决这些问题的核心手段。

本文从DI容器、构造函数注入、接口隔离、生命周期管理、循环依赖、测试友好设计和设计原则七个方面，讲解如何为Skill系统构建松耦合、高内聚、易测试的模块化架构。

## 为什么Skill需要依赖注入

依赖注入听起来像是面向对象编程的高级概念，但它的核心思想很简单：一个组件不应该自己创建它需要的依赖，而应该由外部提供。这种看似简单的转变，却能带来架构层面的巨大改善。

在Skill系统中，一个典型的Skill可能依赖以下组件：

- LLM客户端：调用大语言模型
- 工具执行器：调用外部工具
- 知识库：检索相关知识
- 配置管理器：获取配置参数
- 日志记录器：记录操作日志
- 状态管理器：保存和恢复状态

如果这些依赖都在Skill内部硬编码创建，会带来三个严重问题。

第一，难以替换实现。比如你想从OpenAI的模型切换到Anthropic的模型，如果模型客户端是在Skill内部创建的，你就需要修改Skill的源代码。但如果模型客户端是通过依赖注入提供的，你只需要在配置中切换实现类即可。

第二，难以测试。单元测试需要隔离被测组件，但如果组件自己创建了依赖，测试就很难控制这些依赖的行为。通过依赖注入，测试可以传入模拟（Mock）对象，精确控制测试场景。

第三，难以复用。当多个Skill需要相同的依赖时，每个Skill都自己创建一份实例，不仅浪费资源，还可能导致状态不一致。依赖注入容器可以管理这些共享依赖的生命周期。

```typescript
// 反面教材：Skill自己创建依赖
class BadSkill {
  private llmClient = new OpenAIClient({ apiKey: process.env.OPENAI_KEY! });
  private toolExecutor = new ToolExecutor();
  private logger = new ConsoleLogger();
  
  async execute(input: string): Promise<string> {
    this.logger.log(`Executing: ${input}`);
    const result = await this.llmClient.chat(input);
    return this.toolExecutor.run(result);
  }
}

// 正面示例：通过构造函数注入依赖
class GoodSkill {
  constructor(
    private llmClient: LLMClient,
    private toolExecutor: ToolExecutor,
    private logger: Logger
  ) {}
  
  async execute(input: string): Promise<string> {
    this.logger.log(`Executing: ${input}`);
    const result = await this.llmClient.chat(input);
    return this.toolExecutor.run(result);
  }
}

// 使用依赖注入容器创建Skill
const container = new DIContainer();
container.register(LLMClient, new OpenAIClient({ apiKey: '...' }));
container.register(ToolExecutor, new ToolExecutor());
container.register(Logger, new FileLogger('skill.log'));

const skill = container.resolve(GoodSkill);
```

上面的对比很清楚地展示了依赖注入的价值。`GoodSkill`不关心依赖的具体实现，只关心依赖的接口。这让它可以在不同的环境中使用不同的实现，也更容易测试。

## DI容器：依赖注入的基础设施

依赖注入容器是管理组件及其依赖关系的核心设施。它负责创建组件实例、解析依赖关系、管理生命周期，并提供依赖查找的能力。

一个良好的DI容器应该支持以下功能：

- 注册绑定：将接口绑定到实现
- 生命周期管理：控制实例是单例、作用域内单例还是每次新建
- 自动装配：根据构造函数参数自动解析依赖
- 循环依赖检测：发现并处理循环依赖
- 延迟加载：支持按需创建依赖

```typescript
// 简易DI容器实现
class DIContainer {
  private registrations: Map<symbol | string, Registration> = new Map();
  private singletons: Map<symbol | string, any> = new Map();
  private resolutionStack: Array<symbol | string> = [];
  
  register<T>(
    token: InjectionToken<T>,
    implementation: Constructor<T> | T,
    options: RegistrationOptions = {}
  ): this {
    this.registrations.set(token, {
      implementation,
      lifetime: options.lifetime || 'transient',
      factory: options.factory
    });
    return this;
  }
  
  resolve<T>(token: InjectionToken<T>): T {
    // 检测循环依赖
    if (this.resolutionStack.includes(token)) {
      const cycle = this.resolutionStack.slice(
        this.resolutionStack.indexOf(token)
      ).concat(token);
      throw new Error(
        `Circular dependency detected: ${cycle.map(t => t.toString()).join(' -> ')}`
      );
    }
    
    // 单例模式：直接返回已有实例
    if (this.singletons.has(token)) {
      return this.singletons.get(token);
    }
    
    const registration = this.registrations.get(token);
    if (!registration) {
      // 如果token是类且未注册，尝试自动注册
      if (typeof token === 'function') {
        return this.createInstance(token as Constructor<T>);
      }
      throw new Error(`No registration found for token: ${token.toString()}`);
    }
    
    this.resolutionStack.push(token);
    
    try {
      let instance: T;
      
      if (registration.factory) {
        instance = registration.factory(this);
      } else if (typeof registration.implementation === 'function') {
        instance = this.createInstance(registration.implementation as Constructor<T>);
      } else {
        instance = registration.implementation as T;
      }
      
      // 缓存单例
      if (registration.lifetime === 'singleton') {
        this.singletons.set(token, instance);
      }
      
      return instance;
    } finally {
      this.resolutionStack.pop();
    }
  }
  
  private createInstance<T>(constructor: Constructor<T>): T {
    // 获取构造函数参数类型
    const paramTypes = Reflect.getMetadata('design:paramtypes', constructor) || [];
    
    // 递归解析依赖
    const dependencies = paramTypes.map((paramType: any) => {
      if (paramType === undefined) {
        throw new Error(`Cannot resolve dependency for ${constructor.name}. Ensure all parameters are injectable.`);
      }
      return this.resolve(paramType);
    });
    
    return new constructor(...dependencies);
  }
  
  createScope(): DIContainer {
    const scope = new DIContainer();
    scope.registrations = this.registrations;
    scope.singletons = this.singletons;
    return scope;
  }
}

// 类型定义
interface Registration {
  implementation: any;
  lifetime: Lifetime;
  factory?: (container: DIContainer) => any;
}

interface RegistrationOptions {
  lifetime?: Lifetime;
  factory?: (container: DIContainer) => any;
}

type InjectionToken<T> = Constructor<T> | symbol | string;
type Constructor<T> = new (...args: any[]) => T;
type Lifetime = 'singleton' | 'scoped' | 'transient';

// 装饰器：标记可注入的类
function Injectable() {
  return function <T extends Constructor<any>>(constructor: T) {
    // 保留类型元数据
    return constructor;
  };
}

// 装饰器：注入依赖
function Inject(token: InjectionToken<any>) {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    const existingTokens = Reflect.getMetadata('custom:inject', target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata('custom:inject', existingTokens, target);
  };
}
```

这个简易DI容器实现了核心功能：注册、解析、单例管理、循环依赖检测。在实际项目中，你可能会使用成熟的库如InversifyJS、TSyringe或NestJS内置的容器，但它们的核心原理是相通的。

## 构造函数注入：最推荐的注入方式

依赖注入有三种常见方式：构造函数注入、属性注入和方法注入。在Skill系统中，构造函数注入是最推荐的方式，原因有三：

第一，不可变性。通过构造函数注入的依赖通常在对象创建后就确定下来，不会被后续修改。这减少了状态变化带来的不确定性。

第二，明确性。构造函数参数清晰地展示了类的依赖关系。阅读构造函数就能知道类需要什么，而不需要扫描整个类的属性。

第三，强制完整性。构造函数参数是必填的，这保证了对象创建时所有依赖都已就位，不会出现"部分初始化"的状态。

```typescript
// 构造函数注入示例：代码审查Skill
interface CodeReviewerDeps {
  llmClient: LLMClient;
  astParser: ASTParser;
  ruleEngine: RuleEngine;
  logger: Logger;
  metricsCollector: MetricsCollector;
}

@Injectable()
class CodeReviewSkill {
  constructor(
    private llmClient: LLMClient,
    private astParser: ASTParser,
    private ruleEngine: RuleEngine,
    private logger: Logger,
    private metricsCollector: MetricsCollector
  ) {}
  
  async reviewCode(params: ReviewParams): Promise<ReviewResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting code review for ${params.filePath}`);
      
      // 解析代码结构
      const ast = await this.astParser.parse(params.code);
      
      // 运行静态规则检查
      const ruleViolations = await this.ruleEngine.check(ast);
      
      // 使用LLM进行深度分析
      const llmAnalysis = await this.llmClient.chat([
        {
          role: 'system',
          content: 'You are an expert code reviewer. Analyze the following code for bugs, security issues, and best practices.'
        },
        {
          role: 'user',
          content: params.code
        }
      ]);
      
      // 合并结果
      const result: ReviewResult = {
        filePath: params.filePath,
        issues: [
          ...ruleViolations.map(v => ({
            type: 'rule' as const,
            severity: v.severity,
            message: v.message,
            line: v.line
          })),
          ...this.parseLLMAnalysis(llmAnalysis)
        ],
        summary: llmAnalysis.summary
      };
      
      this.metricsCollector.record('code_review.duration', Date.now() - startTime);
      this.metricsCollector.record('code_review.issues_found', result.issues.length);
      
      return result;
      
    } catch (error) {
      this.logger.error('Code review failed', error);
      this.metricsCollector.record('code_review.errors', 1);
      throw error;
    }
  }
  
  private parseLLMAnalysis(analysis: LLMResponse): Issue[] {
    // 解析LLM返回的分析结果
    return analysis.issues || [];
  }
}

// 使用工厂函数创建预配置的Skill实例
class SkillFactory {
  constructor(private container: DIContainer) {}
  
  createCodeReviewSkill(): CodeReviewSkill {
    return this.container.resolve(CodeReviewSkill);
  }
  
  createCodeReviewSkillWithCustomRules(rules: Rule[]): CodeReviewSkill {
    // 可以基于基础配置创建定制版本
    const skill = this.container.resolve(CodeReviewSkill);
    // 注入自定义规则...
    return skill;
  }
}
```

上面的示例展示了构造函数注入在实际Skill开发中的应用。`CodeReviewSkill`的所有依赖都通过构造函数传入，这使得它的行为完全由外部控制，也便于测试时注入Mock对象。

## 接口隔离：定义清晰的契约

接口隔离原则（Interface Segregation Principle，ISP）指出：客户端不应该被迫依赖它们不使用的接口。在Skill系统中，这意味着我们应该为不同的使用场景定义精细的接口，而不是一个包罗万象的大接口。

```typescript
// 反面教材：臃肿的接口
interface BadLLMClient {
  chat(messages: Message[]): Promise<string>;
  chatStream(messages: Message[]): AsyncIterable<string>;
  embed(text: string): Promise<number[]>;
  fineTune(dataset: Dataset): Promise<Model>;
  listModels(): Promise<ModelInfo[]>;
  deleteModel(id: string): Promise<void>;
}

// 正面示例：细分的接口
interface ChatClient {
  chat(messages: Message[]): Promise<ChatResponse>;
  chatStream(messages: Message[]): AsyncIterable<string>;
}

interface EmbeddingClient {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

interface ModelManager {
  listModels(): Promise<ModelInfo[]>;
  getModel(id: string): Promise<ModelInfo>;
}

// Skill只需要聊天能力，不需要嵌入和管理能力
class SimpleSkill {
  constructor(private chatClient: ChatClient) {}
  
  async execute(input: string): Promise<string> {
    const response = await this.chatClient.chat([
      { role: 'user', content: input }
    ]);
    return response.content;
  }
}

// 高级Skill可能需要多种能力
class AdvancedSkill {
  constructor(
    private chatClient: ChatClient,
    private embeddingClient: EmbeddingClient
  ) {}
  
  async executeWithRAG(input: string): Promise<string> {
    // 使用嵌入检索相关知识
    const queryEmbedding = await this.embeddingClient.embed(input);
    const relevantDocs = await this.searchKnowledgeBase(queryEmbedding);
    
    // 使用聊天能力生成回答
    const response = await this.chatClient.chat([
      { role: 'system', content: `Context: ${relevantDocs.join('\n')}` },
      { role: 'user', content: input }
    ]);
    
    return response.content;
  }
  
  private async searchKnowledgeBase(embedding: number[]): Promise<string[]> {
    // 知识库检索逻辑
    return [];
  }
}

// 适配器模式：将具体实现适配到接口
class OpenAIAdapter implements ChatClient, EmbeddingClient, ModelManager {
  constructor(private client: OpenAI) {}
  
  async chat(messages: Message[]): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages
    });
    return {
      content: response.choices[0].message.content || '',
      usage: response.usage
    };
  }
  
  async *chatStream(messages: Message[]): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages,
      stream: true
    });
    
    for await (const chunk of stream) {
      yield chunk.choices[0]?.delta?.content || '';
    }
  }
  
  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    });
    return response.data[0].embedding;
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-ada-002',
      input: texts
    });
    return response.data.map(d => d.embedding);
  }
  
  async listModels(): Promise<ModelInfo[]> {
    const models = await this.client.models.list();
    return models.data.map(m => ({
      id: m.id,
      ownedBy: m.owned_by
    }));
  }
  
  async getModel(id: string): Promise<ModelInfo> {
    const model = await this.client.models.retrieve(id);
    return {
      id: model.id,
      ownedBy: model.owned_by
    };
  }
}
```

接口隔离的好处在于灵活性。`SimpleSkill`只需要`ChatClient`接口，不需要了解嵌入或模型管理的细节。当需要切换LLM提供商时，只需要提供新的适配器，而不需要修改Skill本身。

## 生命周期管理：控制依赖的创建和销毁

依赖的生命周期管理是DI容器的核心职责之一。不同的依赖可能需要不同的生命周期策略：

- 单例（Singleton）：整个应用只有一个实例，适合无状态服务
- 作用域（Scoped）：在一个作用域内只有一个实例，适合请求级别的依赖
- 瞬态（Transient）：每次请求都创建新实例，适合有状态的组件

在Skill系统中，生命周期管理尤为重要，因为Skill可能需要在不同的上下文中执行，每个上下文可能需要独立的依赖实例。

```typescript
// 生命周期管理示例
class SkillExecutionContext {
  constructor(
    private container: DIContainer,
    public requestId: string,
    public userId: string,
    public metadata: Record<string, any>
  ) {}
  
  // 创建作用域内的Skill实例
  createSkill<T>(token: InjectionToken<T>): T {
    const scope = this.container.createScope();
    
    // 在作用域内注册上下文相关的依赖
    scope.register('requestId', this.requestId);
    scope.register('userId', this.userId);
    scope.register('context', this);
    
    return scope.resolve(token);
  }
}

// 支持作用域的日志记录器
class ScopedLogger implements Logger {
  constructor(
    @Inject('requestId') private requestId: string,
    private delegate: Logger
  ) {}
  
  info(message: string, ...args: any[]): void {
    this.delegate.info(`[${this.requestId}] ${message}`, ...args);
  }
  
  error(message: string, error?: Error): void {
    this.delegate.error(`[${this.requestId}] ${message}`, error);
  }
  
  warn(message: string, ...args: any[]): void {
    this.delegate.warn(`[${this.requestId}] ${message}`, ...args);
  }
  
  debug(message: string, ...args: any[]): void {
    this.delegate.debug(`[${this.requestId}] ${message}`, ...args);
  }
}

// 有状态的Skill，需要每次新建
class StatefulConversationSkill {
  private conversationHistory: Message[] = [];
  
  constructor(private llmClient: LLMClient) {}
  
  async chat(userMessage: string): Promise<string> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });
    
    const response = await this.llmClient.chat(this.conversationHistory);
    
    this.conversationHistory.push({
      role: 'assistant',
      content: response.content
    });
    
    return response.content;
  }
  
  getHistory(): Message[] {
    return [...this.conversationHistory];
  }
  
  clearHistory(): void {
    this.conversationHistory = [];
  }
}

// 容器配置示例
function configureContainer(): DIContainer {
  const container = new DIContainer();
  
  // 单例：LLM客户端，线程安全，可以共享
  container.register(LLMClient, OpenAIAdapter, { lifetime: 'singleton' });
  
  // 单例：规则引擎，配置加载后不变
  container.register(RuleEngine, DefaultRuleEngine, { lifetime: 'singleton' });
  
  // 作用域：日志记录器，每个请求一个实例
  container.register(Logger, ScopedLogger, { lifetime: 'scoped' });
  
  // 瞬态：有状态的Skill，每次创建新实例
  container.register(StatefulConversationSkill, StatefulConversationSkill, { 
    lifetime: 'transient' 
  });
  
  // 瞬态：代码审查Skill
  container.register(CodeReviewSkill, CodeReviewSkill, { 
    lifetime: 'transient' 
  });
  
  return container;
}
```

生命周期管理确保了资源的高效利用。单例避免了重复创建昂贵的对象，作用域隔离了不同请求的上下文，瞬态保证了有状态组件的独立性。

## 循环依赖：识别与破解

循环依赖是模块化设计中常见的问题。当模块A依赖模块B，而模块B又依赖模块A时，就形成了循环依赖。在DI容器中，循环依赖会导致解析失败。

```typescript
// 循环依赖示例
class SkillA {
  constructor(private skillB: SkillB) {}
}

class SkillB {
  constructor(private skillA: SkillA) {}
}

// 容器解析时会抛出错误：Circular dependency detected
```

破解循环依赖的常见策略有三种：

第一，重新设计依赖关系。循环依赖往往意味着职责划分不够清晰。通过提取公共接口或重构职责，可以打破循环。

第二，使用属性注入或Setter注入。将其中一个依赖改为属性注入，绕过构造函数的循环检测。

第三，使用事件驱动或消息队列替代直接依赖。让模块通过事件通信，而不是直接调用。

```typescript
// 策略1：提取接口，反转依赖
interface ISkillA {
  performTask(input: string): Promise<string>;
}

interface ISkillB {
  processResult(result: string): Promise<string>;
}

class SkillA implements ISkillA {
  constructor(private skillB: ISkillB) {}
  
  async performTask(input: string): Promise<string> {
    const intermediate = await this.process(input);
    return this.skillB.processResult(intermediate);
  }
  
  private async process(input: string): Promise<string> {
    return `processed: ${input}`;
  }
}

class SkillB implements ISkillB {
  // SkillB不再直接依赖SkillA，而是依赖接口
  constructor(private eventBus: EventBus) {}
  
  async processResult(result: string): Promise<string> {
    const processed = await this.transform(result);
    
    // 通过事件通知其他组件，而不是直接调用
    this.eventBus.publish({
      type: 'skill:b:completed',
      payload: { result: processed }
    });
    
    return processed;
  }
  
  private async transform(result: string): Promise<string> {
    return `transformed: ${result}`;
  }
}

// 策略2：使用Setter注入
class LazySkillA {
  private skillB!: SkillB;
  
  constructor(private container: DIContainer) {}
  
  // 延迟解析依赖
  getSkillB(): SkillB {
    if (!this.skillB) {
      this.skillB = this.container.resolve(SkillB);
    }
    return this.skillB;
  }
  
  async performTask(input: string): Promise<string> {
    const result = await this.process(input);
    return this.getSkillB().processResult(result);
  }
  
  private async process(input: string): Promise<string> {
    return `processed: ${input}`;
  }
}

// 策略3：使用事件驱动
class EventDrivenSkillA {
  constructor(private eventBus: EventBus) {
    this.eventBus.subscribe('skill:b:completed', this.onSkillBCompleted.bind(this));
  }
  
  async performTask(input: string): Promise<void> {
    const result = await this.process(input);
    
    // 通过事件请求SkillB处理，而不是直接调用
    this.eventBus.publish({
      type: 'skill:a:request',
      payload: { result }
    });
  }
  
  private async process(input: string): Promise<string> {
    return `processed: ${input}`;
  }
  
  private onSkillBCompleted(event: AgentEvent): void {
    console.log('SkillB completed:', event.payload.result);
  }
}

class EventDrivenSkillB {
  constructor(private eventBus: EventBus) {
    this.eventBus.subscribe('skill:a:request', this.onSkillARequest.bind(this));
  }
  
  private async onSkillARequest(event: AgentEvent): Promise<void> {
    const result = await this.transform(event.payload.result);
    
    this.eventBus.publish({
      type: 'skill:b:completed',
      payload: { result }
    });
  }
  
  private async transform(result: string): Promise<string> {
    return `transformed: ${result}`;
  }
}
```

最推荐的策略是重新设计依赖关系。事件驱动虽然能打破循环，但增加了系统的复杂性和不确定性。Setter注入虽然简单，但破坏了不可变性的好处。

## 测试友好的设计

依赖注入最大的好处之一就是可测试性。通过注入Mock对象，测试可以精确控制被测组件的依赖行为，测试各种边界情况。

```typescript
// 可测试的Skill设计
import { jest } from '@jest/globals';

describe('CodeReviewSkill', () => {
  let skill: CodeReviewSkill;
  let mockLLMClient: jest.Mocked<LLMClient>;
  let mockASTParser: jest.Mocked<ASTParser>;
  let mockRuleEngine: jest.Mocked<RuleEngine>;
  let mockLogger: jest.Mocked<Logger>;
  let mockMetrics: jest.Mocked<MetricsCollector>;
  
  beforeEach(() => {
    // 创建Mock对象
    mockLLMClient = {
      chat: jest.fn()
    } as any;
    
    mockASTParser = {
      parse: jest.fn()
    } as any;
    
    mockRuleEngine = {
      check: jest.fn()
    } as any;
    
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;
    
    mockMetrics = {
      record: jest.fn()
    } as any;
    
    // 注入Mock依赖
    skill = new CodeReviewSkill(
      mockLLMClient,
      mockASTParser,
      mockRuleEngine,
      mockLogger,
      mockMetrics
    );
  });
  
  it('should return combined issues from rules and LLM', async () => {
    // 配置Mock行为
    mockASTParser.parse.mockResolvedValue({ type: 'Program', body: [] });
    
    mockRuleEngine.check.mockResolvedValue([
      { severity: 'error', message: 'Missing return type', line: 10 }
    ]);
    
    mockLLMClient.chat.mockResolvedValue({
      content: '',
      issues: [
        { type: 'llm', severity: 'warning', message: 'Consider using const', line: 5 }
      ]
    });
    
    // 执行测试
    const result = await skill.reviewCode({
      filePath: 'test.ts',
      code: 'function test() {}'
    });
    
    // 验证结果
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].message).toBe('Missing return type');
    expect(result.issues[1].message).toBe('Consider using const');
  });
  
  it('should handle LLM failures gracefully', async () => {
    mockASTParser.parse.mockResolvedValue({ type: 'Program', body: [] });
    mockRuleEngine.check.mockResolvedValue([]);
    mockLLMClient.chat.mockRejectedValue(new Error('LLM API timeout'));
    
    await expect(skill.reviewCode({
      filePath: 'test.ts',
      code: 'function test() {}'
    })).rejects.toThrow('LLM API timeout');
    
    // 验证错误被记录
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Code review failed',
      expect.any(Error)
    );
    
    // 验证错误指标被收集
    expect(mockMetrics.record).toHaveBeenCalledWith('code_review.errors', 1);
  });
  
  it('should record performance metrics', async () => {
    mockASTParser.parse.mockResolvedValue({ type: 'Program', body: [] });
    mockRuleEngine.check.mockResolvedValue([]);
    mockLLMClient.chat.mockResolvedValue({ content: '', issues: [] });
    
    await skill.reviewCode({
      filePath: 'test.ts',
      code: 'function test() {}'
    });
    
    // 验证性能指标
    expect(mockMetrics.record).toHaveBeenCalledWith(
      'code_review.duration',
      expect.any(Number)
    );
    expect(mockMetrics.record).toHaveBeenCalledWith('code_review.issues_found', 0);
  });
});

// 集成测试：使用内存中的依赖
class InMemoryLLMClient implements LLMClient {
  private responses: Map<string, ChatResponse> = new Map();
  
  setResponse(prompt: string, response: ChatResponse): void {
    this.responses.set(prompt, response);
  }
  
  async chat(messages: Message[]): Promise<ChatResponse> {
    const prompt = messages.map(m => m.content).join('\n');
    const response = this.responses.get(prompt);
    
    if (!response) {
      throw new Error(`No mock response for prompt: ${prompt}`);
    }
    
    return response;
  }
}

describe('CodeReviewSkill Integration', () => {
  it('should work with in-memory dependencies', async () => {
    const llmClient = new InMemoryLLMClient();
    llmClient.setResponse('function test() {}', {
      content: 'Looks good',
      issues: []
    });
    
    const skill = new CodeReviewSkill(
      llmClient,
      new SimpleASTParser(),
      new DefaultRuleEngine(),
      new ConsoleLogger(),
      new NoOpMetricsCollector()
    );
    
    const result = await skill.reviewCode({
      filePath: 'test.ts',
      code: 'function test() {}'
    });
    
    expect(result.issues).toHaveLength(0);
  });
});
```

通过依赖注入，测试变得简单而直接。Mock对象可以精确模拟各种场景：正常响应、错误情况、超时、空结果等。这大大提高了测试覆盖率和代码质量。

## 实际案例：构建模块化的Agent插件系统

让我们通过一个实际案例，综合运用上述设计模式。假设我们要构建一个支持插件扩展的Agent系统，用户可以通过编写插件来扩展Agent的能力。

```typescript
// 插件接口定义
interface AgentPlugin {
  readonly name: string;
  readonly version: string;
  initialize(context: PluginContext): Promise<void>;
  registerTools(registry: ToolRegistry): void;
  registerSkills(registry: SkillRegistry): void;
  shutdown(): Promise<void>;
}

interface PluginContext {
  container: DIContainer;
  config: PluginConfig;
  logger: Logger;
  eventBus: EventBus;
}

// 插件管理器
class PluginManager {
  private plugins: Map<string, AgentPlugin> = new Map();
  private container: DIContainer;
  private eventBus: EventBus;
  
  constructor(container: DIContainer, eventBus: EventBus) {
    this.container = container;
    this.eventBus = eventBus;
  }
  
  async loadPlugin(pluginClass: new () => AgentPlugin, config: PluginConfig): Promise<void> {
    const plugin = new pluginClass();
    
    // 为插件创建独立的容器作用域
    const pluginContainer = this.container.createScope();
    
    const context: PluginContext = {
      container: pluginContainer,
      config,
      logger: new PluginLogger(plugin.name),
      eventBus: this.eventBus
    };
    
    // 初始化插件
    await plugin.initialize(context);
    
    // 注册插件提供的工具和Skill
    plugin.registerTools({
      register: (name: string, tool: Tool) => {
        this.container.register(`tool:${name}`, tool);
      }
    });
    
    plugin.registerSkills({
      register: (name: string, skill: Skill) => {
        this.container.register(`skill:${name}`, skill);
      }
    });
    
    this.plugins.set(plugin.name, plugin);
    
    this.eventBus.publish({
      type: 'plugin:loaded',
      payload: { name: plugin.name, version: plugin.version }
    });
  }
  
  async unloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }
    
    await plugin.shutdown();
    this.plugins.delete(name);
    
    this.eventBus.publish({
      type: 'plugin:unloaded',
      payload: { name }
    });
  }
  
  getLoadedPlugins(): Array<{ name: string; version: string }> {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.name,
      version: p.version
    }));
  }
}

// 示例插件：代码分析插件
class CodeAnalysisPlugin implements AgentPlugin {
  readonly name = 'code-analysis';
  readonly version = '1.0.0';
  
  private context!: PluginContext;
  
  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    this.context.logger.info('Code analysis plugin initialized');
    
    // 插件可以注册自己的依赖
    context.container.register('codeAnalyzer', new AdvancedCodeAnalyzer());
  }
  
  registerTools(registry: ToolRegistry): void {
    // 注册代码分析工具
    registry.register('analyze_code', new AnalyzeCodeTool(this.context.container));
    registry.register('find_bugs', new FindBugsTool(this.context.container));
  }
  
  registerSkills(registry: SkillRegistry): void {
    // 注册代码审查Skill
    registry.register('code_review', new CodeReviewSkill(
      this.context.container.resolve(LLMClient),
      this.context.container.resolve('codeAnalyzer'),
      new DefaultRuleEngine(),
      this.context.logger,
      new NoOpMetricsCollector()
    ));
  }
  
  async shutdown(): Promise<void> {
    this.context.logger.info('Code analysis plugin shutting down');
  }
}

// 工具实现
class AnalyzeCodeTool implements Tool {
  constructor(private container: DIContainer) {}
  
  async execute(params: { code: string; language: string }): Promise<any> {
    const analyzer = this.container.resolve('codeAnalyzer');
    return analyzer.analyze(params.code, params.language);
  }
}

class FindBugsTool implements Tool {
  constructor(private container: DIContainer) {}
  
  async execute(params: { code: string }): Promise<any> {
    const analyzer = this.container.resolve('codeAnalyzer');
    return analyzer.findBugs(params.code);
  }
}
```

这个插件系统展示了依赖注入和模块化设计的威力。每个插件都通过统一的接口与系统交互，插件之间完全解耦。插件可以注册自己的依赖、工具和Skill，而不会影响到其他插件或核心系统。

## 设计原则总结

在Skill系统的模块化设计中，以下原则至关重要：

**1. 依赖倒置原则（DIP）**
高层模块不应该依赖低层模块，二者都应该依赖抽象。Skill不应该依赖具体的LLM客户端实现，而应该依赖`LLMClient`接口。

**2. 单一职责原则（SRP）**
每个模块只负责一件事。一个Skill不应该同时处理业务逻辑、日志记录和错误处理，这些职责应该分配给不同的模块。

**3. 接口隔离原则（ISP）**
客户端不应该被迫依赖它们不使用的接口。将大接口拆分成多个小接口，让客户端只依赖自己需要的部分。

**4. 开闭原则（OCP）**
模块应该对扩展开放，对修改关闭。通过依赖注入和接口，新功能可以通过新增模块实现，而不需要修改现有代码。

**5. 组合优于继承**
通过依赖注入组合多个小模块，而不是通过继承获得功能。组合更灵活，也更容易测试。

**6. 显式依赖优于隐式依赖**
所有依赖都应该通过构造函数或其他显式方式传入，而不是在内部创建或从全局状态获取。这让依赖关系一目了然。

依赖注入和模块化设计不是银弹，但它们是构建可维护、可测试、可扩展的Skill系统的基础。好的架构设计让系统能够优雅地应对需求变化，而不是在变化面前变得越来越脆弱。
