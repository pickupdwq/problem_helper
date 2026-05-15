---
layout: ../../layouts/ArticleLayout.astro
title: "Agent边界情况处理与异常恢复"
lang: "zh-CN"
pubDate: 2026-04-22
updatedDate: 2026-04-22
description: "深入探讨Agent系统在边界情况下的处理策略与异常恢复机制，涵盖边界识别、防御编程、优雅降级、部分失败、超时处理、资源泄漏防护和恢复策略。"
author: "派"
tags: ["边界情况", "异常恢复", "防御编程", "系统健壮性"]
draft: false
---

Agent系统在实际运行中，很少会按照理想的路径执行。用户可能输入恶意内容、外部API可能超时、内存可能耗尽、网络可能中断。这些边界情况和异常场景，如果不加处理，轻则导致单次请求失败，重则拖垮整个系统。构建健壮的Agent系统，必须把边界情况处理作为一等公民对待。

本文从边界识别、防御编程、优雅降级、部分失败、超时处理、资源泄漏防护和恢复策略七个方面，系统性地讲解如何让Agent系统在各种异常场景下都能保持稳定运行。

## 边界识别：找出系统的脆弱点

边界识别是防御性编程的第一步。你需要系统地梳理Agent可能遇到的各种异常情况，然后针对每种情况制定应对策略。

Agent系统常见的边界情况包括：

- **输入边界**：超长文本、特殊字符、编码问题、空输入、恶意注入
- **资源边界**：内存不足、CPU过载、文件句柄耗尽、连接池饱和
- **时间边界**：操作超时、时钟回拨、定时器漂移
- **外部依赖边界**：API不可用、响应格式异常、速率限制、证书过期
- **状态边界**：会话过期、状态不一致、竞态条件
- **并发边界**：死锁、活锁、数据竞争、资源饥饿

识别边界的方法有两种：一是从代码层面进行静态分析，检查所有可能抛出异常的地方；二是从场景层面进行头脑风暴，让团队成员列举可能遇到的异常情况。

```typescript
// 边界情况清单接口
interface BoundaryChecklist {
  category: string;
  scenarios: BoundaryScenario[];
}

interface BoundaryScenario {
  id: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  likelihood: 'high' | 'medium' | 'low';
  currentHandling: string;
  improvementNeeded: boolean;
}

// Agent边界情况检查器
class AgentBoundaryAnalyzer {
  private checklist: BoundaryChecklist[] = [];

  constructor() {
    this.initializeDefaultChecklist();
  }

  private initializeDefaultChecklist(): void {
    this.checklist = [
      {
        category: '输入验证',
        scenarios: [
          {
            id: 'INPUT-001',
            description: '用户输入超过最大长度限制',
            severity: 'high',
            likelihood: 'high',
            currentHandling: '截断处理',
            improvementNeeded: false
          },
          {
            id: 'INPUT-002',
            description: '用户输入包含SQL注入或XSS攻击代码',
            severity: 'critical',
            likelihood: 'medium',
            currentHandling: '基础过滤',
            improvementNeeded: true
          },
          {
            id: 'INPUT-003',
            description: '用户输入为非预期语言或编码',
            severity: 'medium',
            likelihood: 'medium',
            currentHandling: '未处理',
            improvementNeeded: true
          }
        ]
      },
      {
        category: '外部依赖',
        scenarios: [
          {
            id: 'EXT-001',
            description: 'LLM API响应超时',
            severity: 'critical',
            likelihood: 'high',
            currentHandling: '3次重试后失败',
            improvementNeeded: false
          },
          {
            id: 'EXT-002',
            description: '工具调用返回非预期格式',
            severity: 'high',
            likelihood: 'medium',
            currentHandling: '抛出异常',
            improvementNeeded: true
          }
        ]
      }
    ];
  }

  getCriticalBoundaries(): BoundaryScenario[] {
    return this.checklist
      .flatMap(c => c.scenarios)
      .filter(s => s.severity === 'critical' && s.improvementNeeded);
  }

  generateReport(): string {
    const total = this.checklist.reduce((sum, c) => sum + c.scenarios.length, 0);
    const critical = this.getCriticalBoundaries().length;
    return `边界情况分析报告：共 ${total} 个场景，${critical} 个需要立即处理的关键场景`;
  }
}
```

建议每个Agent项目都维护一份边界情况清单，定期评审和更新。新功能上线前，必须检查是否引入了新的边界情况。

## 防御编程：不信任任何输入

防御编程的核心哲学是：永远不要信任任何输入，包括你自己的代码。每一个外部边界都是潜在的攻击面或故障点。

在Agent系统中，防御编程应该贯穿始终：

1. **输入验证**：对所有用户输入进行长度、类型、格式、范围验证
2. **前置条件检查**：在函数开始时检查所有参数是否符合预期
3. **后置条件断言**：在函数结束时检查结果是否符合预期
4. **不变式保护**：确保关键数据在操作前后保持一致性
5. **安全默认值**：当配置缺失时使用安全的默认值，而不是危险的默认值

```typescript
// 防御性输入验证器
class DefensiveInputValidator {
  static validateUserMessage(input: unknown): { valid: boolean; sanitized?: string; error?: string } {
    // 检查null/undefined
    if (input === null || input === undefined) {
      return { valid: false, error: '输入不能为空' };
    }

    // 检查类型
    if (typeof input !== 'string') {
      return { valid: false, error: `预期字符串，实际得到 ${typeof input}` };
    }

    // 检查长度
    const MAX_LENGTH = 10000;
    if (input.length === 0) {
      return { valid: false, error: '输入不能为空字符串' };
    }
    if (input.length > MAX_LENGTH) {
      return { valid: false, error: `输入过长，最大允许 ${MAX_LENGTH} 字符` };
    }

    // 检查危险字符
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(input)) {
        return { valid: false, error: '检测到潜在的恶意内容' };
      }
    }

    // 规范化处理
    let sanitized = input.trim();
    sanitized = sanitized.replace(/\s+/g, ' '); // 合并连续空白

    return { valid: true, sanitized };
  }

  static validateToolResult(result: unknown, schema: JSONSchema): { valid: boolean; data?: any; error?: string } {
    if (result === null || result === undefined) {
      return { valid: false, error: '工具返回结果为空' };
    }

    try {
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      const validation = this.validateAgainstSchema(parsed, schema);
      
      if (!validation.valid) {
        return { valid: false, error: `结果验证失败: ${validation.error}` };
      }

      return { valid: true, data: parsed };
    } catch (err) {
      return { valid: false, error: `结果解析失败: ${err}` };
    }
  }

  private static validateAgainstSchema(data: any, schema: JSONSchema): { valid: boolean; error?: string } {
    // 简化的schema验证逻辑
    if (schema.type && typeof data !== schema.type) {
      return { valid: false, error: `类型不匹配，预期 ${schema.type}` };
    }

    if (schema.required && Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in data)) {
          return { valid: false, error: `缺少必需字段: ${key}` };
        }
      }
    }

    return { valid: true };
  }
}

// 在Agent中使用防御性验证
class RobustAgent {
  async processMessage(rawInput: unknown): Promise<AgentResponse> {
    // 第一层防御：输入验证
    const validation = DefensiveInputValidator.validateUserMessage(rawInput);
    if (!validation.valid) {
      return {
        success: false,
        error: `输入验证失败: ${validation.error}`,
        suggestion: '请检查输入内容并重试'
      };
    }

    const input = validation.sanitized!;

    // 第二层防御：前置条件检查
    if (!this.isReady()) {
      return {
        success: false,
        error: 'Agent尚未准备就绪',
        suggestion: '请稍后再试'
      };
    }

    try {
      // 第三层防御：带超时的核心处理
      const result = await this.executeWithTimeout(input, 30000);
      
      // 第四层防御：后置条件检查
      if (!this.isValidResult(result)) {
        throw new Error('核心处理返回无效结果');
      }

      return { success: true, data: result };
    } catch (err) {
      return this.handleExecutionError(err);
    }
  }

  private isReady(): boolean {
    return this.state === 'ready' && this.llmClient.isConnected();
  }

  private isValidResult(result: unknown): boolean {
    return result !== null && result !== undefined && typeof result === 'object';
  }

  private async executeWithTimeout(input: string, ms: number): Promise<unknown> {
    return Promise.race([
      this.coreExecute(input),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('执行超时')), ms)
      )
    ]);
  }

  private handleExecutionError(err: unknown): AgentResponse {
    const message = err instanceof Error ? err.message : '未知错误';
    
    // 根据错误类型返回不同的响应
    if (message.includes('超时')) {
      return {
        success: false,
        error: '处理时间过长，请简化问题后重试',
        suggestion: '尝试将复杂问题拆分为多个简单问题'
      };
    }

    return {
      success: false,
      error: '处理过程中发生错误',
      suggestion: '请稍后重试，如果问题持续请联系支持团队'
    };
  }
}
```

防御编程不是过度工程化。每一层防御都应该有明确的目的，避免为了防御而防御。关键是找到安全性和性能之间的平衡点。

## 优雅降级：在故障时保持可用

优雅降级（Graceful Degradation）是指当系统的某些组件失效时，系统仍然能够提供有限但可用的服务，而不是完全崩溃。

Agent系统的优雅降级策略通常包括：

1. **功能降级**：关闭非核心功能，保留核心功能
2. **质量降级**：降低响应质量以保证可用性（如使用更快的但精度较低的模型）
3. **缓存降级**：当实时数据不可用时，使用缓存数据
4. **异步降级**：同步操作失败时，转为异步处理并通知用户

```typescript
// 优雅降级管理器
interface DegradationStrategy {
  name: string;
  condition: (context: DegradationContext) => boolean;
  execute: (context: DegradationContext) => Promise<DegradationResult>;
}

interface DegradationContext {
  originalRequest: unknown;
  failureReason: string;
  failureComponent: string;
  retryCount: number;
  availableComponents: string[];
}

interface DegradationResult {
  success: boolean;
  data?: unknown;
  quality: 'full' | 'reduced' | 'minimal';
  message: string;
}

class GracefulDegradationManager {
  private strategies: Map<string, DegradationStrategy[]> = new Map();

  constructor() {
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // LLM服务不可用的降级策略
    this.strategies.set('llm', [
      {
        name: '切换到备用模型',
        condition: (ctx) => ctx.availableComponents.includes('backup-llm'),
        execute: async (ctx) => {
          const result = await backupLLM.generate(ctx.originalRequest);
          return {
            success: true,
            data: result,
            quality: 'reduced',
            message: '当前使用备用模型，响应质量可能略有降低'
          };
        }
      },
      {
        name: '使用缓存响应',
        condition: (ctx) => ctx.availableComponents.includes('cache'),
        execute: async (ctx) => {
          const cached = await cache.getSimilar(ctx.originalRequest);
          if (cached) {
            return {
              success: true,
              data: cached,
              quality: 'minimal',
              message: '基于历史相似问题提供参考回答'
            };
          }
          return {
            success: false,
            quality: 'minimal',
            message: '暂无可用回答'
          };
        }
      },
      {
        name: '返回静态提示',
        condition: () => true,
        execute: async () => ({
          success: true,
          data: '当前服务繁忙，请稍后再试',
          quality: 'minimal',
          message: '服务暂时不可用'
        })
      }
    ]);

    // 工具调用失败的降级策略
    this.strategies.set('tool', [
      {
        name: '跳过可选工具',
        condition: (ctx) => ctx.failureComponent.startsWith('optional-'),
        execute: async (ctx) => ({
          success: true,
          data: ctx.originalRequest,
          quality: 'reduced',
          message: '部分功能暂时不可用，核心功能正常运行'
        })
      },
      {
        name: '使用模拟数据',
        condition: (ctx) => ctx.availableComponents.includes('mock-data'),
        execute: async (ctx) => {
          const mockResult = await mockDataProvider.get(ctx.failureComponent);
          return {
            success: true,
            data: mockResult,
            quality: 'reduced',
            message: '当前使用模拟数据，实际数据稍后更新'
          };
        }
      }
    ]);
  }

  async handleFailure(
    componentType: string,
    context: DegradationContext
  ): Promise<DegradationResult> {
    const strategies = this.strategies.get(componentType) || [];

    for (const strategy of strategies) {
      if (strategy.condition(context)) {
        console.log(`应用降级策略: ${strategy.name}`);
        const result = await strategy.execute(context);
        if (result.success) {
          return result;
        }
      }
    }

    return {
      success: false,
      quality: 'minimal',
      message: '所有降级策略均已失败，服务暂时不可用'
    };
  }
}

// 使用示例
class ResilientAgent {
  private degradationManager = new GracefulDegradationManager();

  async execute(request: UserRequest): Promise<AgentResponse> {
    try {
      return await this.primaryExecute(request);
    } catch (err) {
      const failureReason = err instanceof Error ? err.message : '未知错误';
      
      const degradationResult = await this.degradationManager.handleFailure(
        'llm',
        {
          originalRequest: request,
          failureReason,
          failureComponent: 'primary-llm',
          retryCount: 0,
          availableComponents: ['backup-llm', 'cache']
        }
      );

      return {
        success: degradationResult.success,
        content: degradationResult.data as string,
        meta: {
          quality: degradationResult.quality,
          message: degradationResult.message
        }
      };
    }
  }
}
```

优雅降级的关键是预先定义好降级路径。在系统设计阶段就要考虑：当A不可用时，能否用B替代？当B也不可用时，最底线是什么？

## 部分失败处理：不让一个错误拖垮全部

在复杂的Agent工作流中，一个步骤的失败不应该导致整个工作流的失败。部分失败处理（Partial Failure Handling）就是解决这个问题的。

部分失败处理的核心思路是：

1. **故障隔离**：将工作流拆分为独立的步骤，每个步骤的失败不影响其他步骤
2. **补偿机制**：当某个步骤失败时，执行补偿操作回滚已完成的步骤
3. **结果合并**：允许部分步骤失败，将成功步骤的结果与失败步骤的错误信息合并返回

```typescript
// 部分失败处理器
interface WorkflowStep {
  id: string;
  name: string;
  execute: () => Promise<StepResult>;
  compensate?: () => Promise<void>;
  critical: boolean; // 是否为关键步骤，关键步骤失败会导致整个工作流失败
}

interface StepResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

interface WorkflowResult {
  overallSuccess: boolean;
  completedSteps: string[];
  failedSteps: { id: string; error: string }[];
  compensatedSteps: string[];
  results: Map<string, unknown>;
}

class PartialFailureWorkflow {
  async execute(steps: WorkflowStep[]): Promise<WorkflowResult> {
    const result: WorkflowResult = {
      overallSuccess: true,
      completedSteps: [],
      failedSteps: [],
      compensatedSteps: [],
      results: new Map()
    };

    const executedSteps: WorkflowStep[] = [];

    for (const step of steps) {
      try {
        console.log(`执行步骤: ${step.name}`);
        const stepResult = await step.execute();

        if (stepResult.success) {
          result.completedSteps.push(step.id);
          if (stepResult.data !== undefined) {
            result.results.set(step.id, stepResult.data);
          }
          executedSteps.push(step);
        } else {
          throw new Error(stepResult.error || '步骤执行失败');
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : '未知错误';
        console.error(`步骤 ${step.name} 失败: ${error}`);

        result.failedSteps.push({ id: step.id, error });

        if (step.critical) {
          result.overallSuccess = false;
          // 对已成功执行的步骤进行补偿
          await this.compensate(executedSteps.reverse(), result);
          break;
        }
        // 非关键步骤失败，继续执行后续步骤
      }
    }

    return result;
  }

  private async compensate(steps: WorkflowStep[], result: WorkflowResult): Promise<void> {
    for (const step of steps) {
      if (step.compensate) {
        try {
          console.log(`补偿步骤: ${step.name}`);
          await step.compensate();
          result.compensatedSteps.push(step.id);
        } catch (err) {
          console.error(`补偿步骤 ${step.name} 失败:`, err);
        }
      }
    }
  }
}

// 实际应用：Agent多工具调用工作流
class MultiToolAgent {
  private workflow = new PartialFailureWorkflow();

  async executeComplexTask(userQuery: string): Promise<WorkflowResult> {
    const steps: WorkflowStep[] = [
      {
        id: 'parse-intent',
        name: '解析用户意图',
        execute: async () => {
          const intent = await this.nlpService.parse(userQuery);
          return { success: true, data: intent, duration: 100 };
        },
        critical: true // 意图解析是关键步骤
      },
      {
        id: 'search-knowledge',
        name: '检索知识库',
        execute: async () => {
          const docs = await this.knowledgeBase.search(userQuery);
          return { success: true, data: docs, duration: 500 };
        },
        critical: false // 知识库检索失败不影响核心流程
      },
      {
        id: 'call-api',
        name: '调用外部API',
        execute: async () => {
          const apiResult = await this.externalAPI.call(userQuery);
          return { success: true, data: apiResult, duration: 2000 };
        },
        compensate: async () => {
          // 如果后续步骤失败，回滚API调用
          await this.externalAPI.rollback();
        },
        critical: false
      },
      {
        id: 'generate-response',
        name: '生成回复',
        execute: async () => {
          const response = await this.llm.generate({
            query: userQuery,
            context: this.getAvailableContext()
          });
          return { success: true, data: response, duration: 3000 };
        },
        critical: true
      }
    ];

    return this.workflow.execute(steps);
  }

  private getAvailableContext(): unknown {
    // 获取当前可用的上下文数据
    return {};
  }
}
```

部分失败处理的关键是合理划分步骤的粒度。步骤太细会增加管理复杂度，步骤太粗会降低容错能力。通常建议将工作流划分为3到7个步骤，每个步骤有明确的输入输出和失败边界。

## 超时处理：防止无限等待

超时是分布式系统中最常见的问题之一。一个外部调用如果没有超时设置，可能在网络异常时无限挂起，耗尽连接池资源，最终导致级联故障。

Agent系统中的超时处理需要多层次的策略：

1. **连接超时**：建立连接的最大等待时间
2. **读取超时**：等待响应的最大时间
3. **总超时**：整个操作的最大执行时间
4. **空闲超时**：连接池中空闲连接的最大存活时间

```typescript
// 多层超时管理器
interface TimeoutConfig {
  connectTimeout: number;
  readTimeout: number;
  totalTimeout: number;
}

interface TimeoutManagerOptions {
  defaultConfig: TimeoutConfig;
  adaptiveTimeout?: boolean;
  timeoutHistorySize?: number;
}

class AdaptiveTimeoutManager {
  private history: Map<string, number[]> = new Map();
  private readonly historySize: number;
  private defaultConfig: TimeoutConfig;

  constructor(options: TimeoutManagerOptions) {
    this.defaultConfig = options.defaultConfig;
    this.historySize = options.timeoutHistorySize || 100;
  }

  // 根据历史性能动态调整超时时间
  getAdaptiveTimeout(operation: string): TimeoutConfig {
    const history = this.history.get(operation);
    if (!history || history.length < 10) {
      return this.defaultConfig;
    }

    const sorted = [...history].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      connectTimeout: Math.min(this.defaultConfig.connectTimeout, p95 * 0.5),
      readTimeout: Math.min(this.defaultConfig.readTimeout, p99 * 1.5),
      totalTimeout: Math.min(this.defaultConfig.totalTimeout, p99 * 2)
    };
  }

  // 记录操作耗时
  recordDuration(operation: string, duration: number): void {
    if (!this.history.has(operation)) {
      this.history.set(operation, []);
    }
    const history = this.history.get(operation)!;
    history.push(duration);
    if (history.length > this.historySize) {
      history.shift();
    }
  }

  // 执行带超时的操作
  async executeWithTimeout<T>(
    operation: string,
    fn: () => Promise<T>,
    customConfig?: Partial<TimeoutConfig>
  ): Promise<T> {
    const config = { ...this.getAdaptiveTimeout(operation), ...customConfig };
    const startTime = Date.now();

    try {
      const result = await this.raceWithTimeout(fn(), config.totalTimeout, operation);
      this.recordDuration(operation, Date.now() - startTime);
      return result;
    } catch (err) {
      this.recordDuration(operation, Date.now() - startTime);
      throw err;
    }
  }

  private raceWithTimeout<T>(promise: Promise<T>, ms: number, context: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`操作超时 (${ms}ms): ${context}`));
        }, ms);
      })
    ]);
  }
}

// 在Agent中应用超时管理
class TimeoutAwareAgent {
  private timeoutManager = new AdaptiveTimeoutManager({
    defaultConfig: {
      connectTimeout: 5000,
      readTimeout: 30000,
      totalTimeout: 60000
    },
    adaptiveTimeout: true
  });

  async callLLM(prompt: string): Promise<string> {
    return this.timeoutManager.executeWithTimeout(
      'llm-call',
      () => this.llmClient.generate(prompt),
      { totalTimeout: 45000 }
    );
  }

  async callTool(toolName: string, params: unknown): Promise<unknown> {
    return this.timeoutManager.executeWithTimeout(
      `tool-${toolName}`,
      () => this.toolRegistry.execute(toolName, params),
      { totalTimeout: 10000 }
    );
  }
}
```

超时时间的设置需要结合实际场景。太短会导致不必要的失败，太长则失去保护意义。建议通过监控收集实际耗时分布，然后基于P95或P99设置超时阈值。

## 资源泄漏防护：守住系统底线

资源泄漏是慢性的系统杀手。内存泄漏、连接泄漏、文件句柄泄漏不会立即导致故障，但会逐渐耗尽系统资源，最终引发不可预测的崩溃。

Agent系统中常见的资源泄漏场景包括：

1. **未关闭的数据库连接**：每个请求都新建连接而不释放
2. **未取消的定时器**：定时器持续累积，占用内存和CPU
3. **未清理的事件监听器**：事件监听器不断增加，导致内存增长
4. **未释放的大对象**：处理大文件或大模型响应后未释放引用
5. **未取消的异步操作**：组件卸载后异步操作仍在执行

```typescript
// 资源泄漏防护工具
interface ResourceTracker {
  acquire(): void;
  release(): void;
  getActiveCount(): number;
}

class ConnectionPool implements ResourceTracker {
  private active = 0;
  private maxConnections: number;
  private queue: Array<() => void> = [];

  constructor(maxConnections: number) {
    this.maxConnections = maxConnections;
  }

  acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.active < this.maxConnections) {
        this.active++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) {
      this.active++;
      next();
    }
  }

  getActiveCount(): number {
    return this.active;
  }
}

// 自动资源管理器
class AutoResourceManager {
  private resources: Set<{ name: string; cleanup: () => void }> = new Set();
  private timers: Set<NodeJS.Timeout> = new Set();
  private abortController: AbortController;

  constructor() {
    this.abortController = new AbortController();
  }

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  setTimeout(fn: () => void, ms: number): NodeJS.Timeout {
    const timer = setTimeout(() => {
      if (!this.abortController.signal.aborted) {
        fn();
      }
      this.timers.delete(timer);
    }, ms);
    this.timers.add(timer);
    return timer;
  }

  setInterval(fn: () => void, ms: number): NodeJS.Timeout {
    const timer = setInterval(() => {
      if (!this.abortController.signal.aborted) {
        fn();
      }
    }, ms);
    this.timers.add(timer);
    return timer;
  }

  registerCleanup(name: string, cleanup: () => void): void {
    this.resources.add({ name, cleanup });
  }

  dispose(): void {
    // 取消所有异步操作
    this.abortController.abort();

    // 清理所有定时器
    for (const timer of this.timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.timers.clear();

    // 执行所有注册的清理函数
    for (const resource of this.resources) {
      try {
        resource.cleanup();
      } catch (err) {
        console.error(`清理资源 ${resource.name} 失败:`, err);
      }
    }
    this.resources.clear();
  }
}

// 在Agent生命周期中使用
class ResourceSafeAgent {
  private resourceManager = new AutoResourceManager();

  constructor() {
    // 注册组件级别的清理
    this.resourceManager.registerCleanup('llm-connection', () => {
      this.llmClient.disconnect();
    });
  }

  async executeTask(task: Task): Promise<TaskResult> {
    // 创建任务级别的资源管理器
    const taskResources = new AutoResourceManager();

    try {
      // 设置任务超时
      const timeoutTimer = taskResources.setTimeout(() => {
        taskResources.dispose();
      }, task.maxDuration);

      // 执行核心逻辑
      const result = await this.processTask(task, taskResources.signal);

      return result;
    } finally {
      // 确保任务资源被清理
      taskResources.dispose();
    }
  }

  destroy(): void {
    this.resourceManager.dispose();
  }
}
```

资源泄漏防护的关键是建立"谁申请谁释放"的原则，并借助自动化工具确保释放逻辑一定会被执行。TypeScript的`using`关键字（基于Symbol.dispose）为资源管理提供了语言级别的支持。

## 恢复策略：从故障中快速恢复

故障不可避免，但恢复速度可以优化。一个好的恢复策略应该能够自动检测故障、自动执行恢复操作、并在恢复后恢复正常服务。

Agent系统的恢复策略通常包括：

1. **自动重启**：进程崩溃后自动重启
2. **健康检查**：定期检查系统健康状态
3. **熔断器**：当故障率超过阈值时，快速失败而不是慢速失败
4. **限流器**：限制请求速率，防止系统过载
5. **缓存预热**：恢复后快速加载常用数据

```typescript
// 熔断器实现
interface CircuitBreakerOptions {
  failureThreshold: number;      // 触发熔断的失败次数
  successThreshold: number;      // 恢复熔断的成功次数
  timeout: number;               // 熔断后尝试恢复的时间
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  lastFailureTime: number;
}

class CircuitBreaker {
  private state: CircuitBreakerState;

  constructor(private options: CircuitBreakerOptions) {
    this.state = {
      state: 'closed',
      failures: 0,
      successes: 0,
      lastFailureTime: 0
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state.state === 'open') {
      if (Date.now() - this.state.lastFailureTime > this.options.timeout) {
        this.state.state = 'half-open';
        this.state.successes = 0;
      } else {
        throw new Error('熔断器已打开，请求被阻止');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.state.failures = 0;

    if (this.state.state === 'half-open') {
      this.state.successes++;
      if (this.state.successes >= this.options.successThreshold) {
        this.state.state = 'closed';
        this.state.successes = 0;
        console.log('熔断器关闭，服务恢复正常');
      }
    }
  }

  private onFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();

    if (this.state.state === 'half-open') {
      this.state.state = 'open';
      console.log('半开状态下再次失败，熔断器重新打开');
    } else if (this.state.failures >= this.options.failureThreshold) {
      this.state.state = 'open';
      console.log(`失败次数达到阈值 ${this.options.failureThreshold}，熔断器打开`);
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }
}

// 健康检查与自动恢复
interface HealthCheck {
  name: string;
  check: () => Promise<{ healthy: boolean; message?: string }>;
}

class HealthMonitor {
  private checks: HealthCheck[] = [];
  private recoveryStrategies: Map<string, () => Promise<boolean>> = new Map();
  private isHealthy = true;

  addCheck(check: HealthCheck): void {
    this.checks.push(check);
  }

  addRecoveryStrategy(component: string, strategy: () => Promise<boolean>): void {
    this.recoveryStrategies.set(component, strategy);
  }

  async runChecks(): Promise<{ overall: boolean; details: Record<string, boolean> }> {
    const details: Record<string, boolean> = {};
    let overall = true;

    for (const check of this.checks) {
      try {
        const result = await check.check();
        details[check.name] = result.healthy;
        if (!result.healthy) {
          overall = false;
          console.warn(`健康检查失败 [${check.name}]: ${result.message}`);
          
          // 尝试自动恢复
          const recovery = this.recoveryStrategies.get(check.name);
          if (recovery) {
            const recovered = await recovery();
            if (recovered) {
              console.log(`自动恢复成功: ${check.name}`);
              details[check.name] = true;
            }
          }
        }
      } catch (err) {
        details[check.name] = false;
        overall = false;
        console.error(`健康检查异常 [${check.name}]:`, err);
      }
    }

    this.isHealthy = overall;
    return { overall, details };
  }

  startMonitoring(intervalMs: number): NodeJS.Timeout {
    return setInterval(() => this.runChecks(), intervalMs);
  }
}

// 完整的恢复策略示例
class ResilientAgentSystem {
  private circuitBreaker: CircuitBreaker;
  private healthMonitor: HealthMonitor;
  private connectionPool: ConnectionPool;

  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000
    });

    this.connectionPool = new ConnectionPool(20);

    this.healthMonitor = new HealthMonitor();
    this.setupHealthChecks();
    this.setupRecoveryStrategies();
  }

  private setupHealthChecks(): void {
    this.healthMonitor.addCheck({
      name: 'llm-connection',
      check: async () => {
        const connected = await this.checkLLMConnection();
        return { healthy: connected, message: connected ? '正常' : '连接失败' };
      }
    });

    this.healthMonitor.addCheck({
      name: 'memory-usage',
      check: async () => {
        const usage = process.memoryUsage();
        const healthy = usage.heapUsed / usage.heapTotal < 0.9;
        return {
          healthy,
          message: healthy ? '正常' : `内存使用率过高: ${(usage.heapUsed / usage.heapTotal * 100).toFixed(1)}%`
        };
      }
    });
  }

  private setupRecoveryStrategies(): void {
    this.healthMonitor.addRecoveryStrategy('llm-connection', async () => {
      try {
        await this.reconnectLLM();
        return true;
      } catch {
        return false;
      }
    });
  }

  async executeWithResilience<T>(fn: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.execute(() => this.connectionPool.acquire().then(async () => {
      try {
        return await fn();
      } finally {
        this.connectionPool.release();
      }
    }));
  }
}
```

恢复策略的设计需要遵循"快速失败、快速恢复"的原则。熔断器防止故障扩散，健康检查及时发现故障，自动恢复减少人工干预。

## 实际案例：构建健壮的电商客服Agent

某电商平台部署了一个智能客服Agent，用于处理用户的订单查询、退换货申请、商品咨询等请求。上线初期，Agent经常出现以下问题：

1. 用户输入超长订单号时，系统抛出未处理的异常
2. 高峰期外部库存API超时，导致所有查询请求卡住
3. 数据库连接未释放，数小时后连接池耗尽
4. 某个工具调用失败后，整个对话流程中断

我们帮助他们构建了一套完整的边界情况处理体系：

1. **输入层防御**：对所有用户输入进行严格的验证和消毒。超长文本自动截断，特殊字符转义，恶意输入直接拒绝。

2. **超时层保护**：所有外部调用都设置了分层超时。库存API的读取超时设为2秒，总超时设为5秒。超时后自动返回"库存信息暂不可用"的友好提示。

3. **资源层管理**：引入连接池和自动资源管理器。每个对话会话结束时，自动清理所有资源。设置连接池最大连接数为50，防止资源耗尽。

4. **故障层隔离**：将对话流程拆分为多个独立的步骤（意图识别、实体提取、API调用、回复生成）。API调用失败时，跳过该步骤继续生成回复，并在回复中说明"部分信息暂时不可用"。

5. **恢复层自动化**：部署健康检查每30秒运行一次。当库存API连续失败5次时，熔断器打开，后续请求直接返回缓存数据。30秒后熔断器进入半开状态，尝试恢复。

改进后的系统稳定性大幅提升：
- 异常导致的对话中断率从15%降低到0.5%
- 系统可用性从97%提升到99.95%
- 资源泄漏导致的重启次数从每天3次降低到每月1次
- 用户满意度从3.8分提升到4.6分（5分制）

## 总结与最佳实践

边界情况处理是Agent系统稳定运行的基石。以下是实践中总结的最佳实践：

**1. 建立边界情况清单**

每个Agent项目都应该维护一份边界情况清单，定期评审和更新。清单应该覆盖输入、资源、时间、外部依赖、状态和并发六个维度。

**2. 多层防御策略**

不要依赖单一的防御机制。在输入层验证、在业务层检查、在资源层限制、在系统层监控。每一层都是一道防线。

**3. 优雅降级优于完全失败**

当某个组件不可用时，尝试提供有限的服务，而不是直接拒绝。用户更愿意看到一个"质量降低"的回复，而不是一个错误提示。

**4. 合理设置超时**

超时是防止级联故障的关键。根据实际性能数据设置超时阈值，并定期调整。记住：没有超时的外部调用就是一颗定时炸弹。

**5. 资源管理自动化**

使用语言特性（如TypeScript的using）或框架工具，确保资源一定会被释放。建立资源泄漏监控，及时发现和修复问题。

**6. 熔断器保护关键路径**

对关键的外部依赖使用熔断器保护。当故障率超过阈值时，快速失败，保护系统资源。设置合理的恢复窗口，避免频繁熔断-恢复震荡。

**7. 测试边界情况**

单元测试和集成测试必须覆盖边界情况。模拟超时、模拟资源不足、模拟网络中断，确保系统在各种异常场景下都能正确处理。

边界情况处理不是一次性工作，而是持续迭代的过程。随着系统规模的扩大和使用场景的丰富，新的边界情况会不断出现。建立完善的监控和告警机制，让团队能够及时发现和处理新的边界问题。
