---
layout: ../../layouts/ArticleLayout.astro
title: "性能优化：Agent与Skill的调优指南"
lang: "zh-CN"
pubDate: 2026-01-14
updatedDate: 2026-01-14
description: "系统性讲解Agent和Skill的性能优化方法，包括延迟优化、吞吐提升、资源管理、缓存策略、并发控制和监控指标等核心实践。"
author: "派"
tags: ["性能优化", "系统调优", "Agent性能", "监控指标"]
draft: false
---

Agent和Skill系统的性能优化和传统软件有些不同。传统应用优化的目标是让代码跑得更快，而AI系统的瓶颈往往在外部服务调用、上下文传输和模型推理上。这篇文章从实际工程经验出发，讲清楚Agent和Skill系统的性能调优方法。

## 识别真正的性能瓶颈

优化之前要先找到瓶颈。Agent系统的性能问题通常集中在四个层面：模型推理、外部调用、上下文传输和编排调度。

模型推理是大多数Agent系统的最大开销。一次复杂的Agent任务可能调用LLM数十次，每次调用都要等待模型生成回复。如果模型是远程部署的，还要加上网络延迟。测量模型推理时间时，要区分首Token延迟和整体生成时间。首Token延迟影响用户感知的响应速度，整体生成时间影响任务完成时间。

```typescript
// 模型调用性能指标收集
interface LLMMetrics {
  promptTokens: number;
  completionTokens: number;
  firstTokenLatency: number;    // 首Token延迟
  totalLatency: number;         // 总延迟
  tokensPerSecond: number;      // 生成速度
  modelName: string;
}

class LLMProfiler {
  private metrics: LLMMetrics[] = [];
  
  async measure<T>(fn: () => Promise<T>, metadata: any): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    
    this.metrics.push({
      ...metadata,
      totalLatency: end - start,
      // 从响应中提取其他指标
    });
    
    return result;
  }
  
  getBottleneckReport() {
    const avgFirstToken = mean(this.metrics.map(m => m.firstTokenLatency));
    const avgTotal = mean(this.metrics.map(m => m.totalLatency));
    const totalTokens = sum(this.metrics.map(m => m.completionTokens));
    
    return {
      avgFirstTokenLatency: avgFirstToken,
      avgTotalLatency: avgTotal,
      totalTokensGenerated: totalTokens,
      estimatedCost: this.estimateCost(),
      optimizationSuggestions: this.generateSuggestions()
    };
  }
}
```

外部调用包括数据库查询、API请求、文件读写等。虽然单次调用通常比模型推理快，但如果调用次数多或者存在串行依赖，累积起来也会成为瓶颈。

上下文传输在链式调用中尤为明显。当Agent调用Skill，Skill又调用子Skill时，上下文数据需要在多个节点之间传递。如果上下文包含大量文件内容或历史记录，传输开销会显著增加。

编排调度是工作流引擎本身的开销。DAG执行时的拓扑排序、状态机的事件处理、并行任务的调度协调，这些都有计算成本。在步骤数量很大时，调度开销可能占到总时间的可观比例。

## 延迟优化：让用户感知更快

用户感知的性能比实际性能更重要。如果一个任务实际要花10秒，但用户在第1秒就看到了部分结果，体验就会好很多。

流式输出是最直接的优化。不要让模型生成完所有内容再返回，而是逐Token或逐句返回。这样用户可以在模型还在思考时就开始阅读，感知延迟大幅降低。

```typescript
// 流式响应处理
async function* streamAgentResponse(agent: Agent, prompt: string) {
  const stream = await agent.llm.streamComplete(prompt);
  let buffer = '';
  
  for await (const chunk of stream) {
    buffer += chunk;
    
    // 按句子边界输出，避免断断续续
    const sentences = buffer.split(/(?<=[。！？.!?])\s+/);
    if (sentences.length > 1) {
      for (let i = 0; i < sentences.length - 1; i++) {
        yield sentences[i];
      }
      buffer = sentences[sentences.length - 1];
    }
  }
  
  if (buffer) yield buffer;
}
```

渐进式加载也很有效。Agent不需要等所有步骤完成才展示结果，可以先展示中间结论，再逐步补充细节。比如一个代码审查Agent，可以先给出总体评价，然后一边分析一边展示具体的问题点。

预加载和预热对减少首Token延迟有帮助。模型推理服务在冷启动时通常比较慢，保持一定数量的预热实例可以显著降低延迟。对于频繁调用的Skill，预加载它的依赖和资源也能节省启动时间。

```python
# 模型服务预热策略
class ModelWarmer:
    def __init__(self, model_pool):
        self.pool = model_pool
        self.minWarmInstances = 2
    
    async def maintain_warm_pool(self):
        while True:
            current_warm = await self.pool.count_warm_instances()
            if current_warm < self.minWarmInstances:
                needed = self.minWarmInstances - current_warm
                for _ in range(needed):
                    await self.pool.warm_up_instance()
            
            await asyncio.sleep(30)  # 每30秒检查一次
```

## 吞吐提升：处理更多并发

提升吞吐量意味着系统能同时服务更多用户或处理更多任务。核心思路是减少不必要的串行、增加并行度和优化资源利用。

并行化是最大的杠杆。Agent任务中很多步骤没有依赖关系，可以并行执行。比如一个文档分析Agent，可以同时做关键词提取、情感分析、摘要生成和格式检查，而不是一个接一个地做。

```yaml
# 并行化工作流配置
workflow:
  nodes:
    - id: load-document
      type: skill
    
    - id: extract-keywords
      type: skill
      dependsOn: [load-document]
    
    - id: sentiment-analysis
      type: skill
      dependsOn: [load-document]
    
    - id: generate-summary
      type: skill
      dependsOn: [load-document]
    
    - id: format-check
      type: skill
      dependsOn: [load-document]
    
    - id: compile-report
      type: skill
      dependsOn: [extract-keywords, sentiment-analysis, generate-summary, format-check]
```

批量处理也能提升吞吐。如果多个任务需要调用同一个外部API，把它们合并成一个批量请求通常比单独请求更快。比如向量检索时，把多个查询打包成一个批量请求，能显著减少网络往返。

```typescript
// 批量请求合并
class BatchingClient {
  private queue: PendingRequest[] = [];
  private timer: NodeJS.Timeout | null = null;
  private maxBatchSize = 32;
  private maxWaitMs = 10;
  
  async request(item: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      
      if (this.queue.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.maxWaitMs);
      }
    });
  }
  
  private async flush() {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, this.maxBatchSize);
    this.timer = null;
    
    try {
      const results = await this.sendBatch(batch.map(b => b.item));
      batch.forEach((b, i) => b.resolve(results[i]));
    } catch (error) {
      batch.forEach(b => b.reject(error));
    }
  }
}
```

模型调用优化方面，可以考虑模型路由。不是所有任务都需要最强的大模型，简单任务可以用小模型快速完成，复杂任务才用大模型。用一个轻量级分类器判断任务复杂度，然后路由到合适的模型。

```python
# 模型路由策略
class ModelRouter:
    def __init__(self):
        self.tiers = {
            'fast': {'model': 'gpt-3.5-turbo', 'max_tokens': 500},
            'balanced': {'model': 'gpt-4', 'max_tokens': 2000},
            'powerful': {'model': 'gpt-4-turbo', 'max_tokens': 8000}
        }
    
    async def route(self, task: Task) -> ModelConfig:
        complexity = await self.assess_complexity(task)
        
        if complexity < 0.3:
            return self.tiers['fast']
        elif complexity < 0.7:
            return self.tiers['balanced']
        else:
            return self.tiers['powerful']
    
    async def assess_complexity(self, task: Task) -> float:
        # 基于任务特征评估复杂度
        features = {
            'input_length': len(task.input) / 10000,
            'required_reasoning': task.requiresMultiStep,
            'domain_complexity': self.getDomainComplexity(task.domain),
            'output_length_estimate': task.expectedOutputLength / 5000
        }
        
        return self.complexityModel.predict(features)
```

## 资源管理：控制成本与容量

Agent系统的资源消耗主要来自模型调用。每次调用都有Token成本，而且不同模型的成本差异很大。不做资源管理，轻则预算超支，重则服务被滥用到不可用。

Token预算是基础防护。为每个用户、每个会话或每个任务设置Token上限，超过就拒绝或降级。预算可以分级别：免费用户每月10万Token，付费用户每月100万Token，企业用户按需购买。

```typescript
// Token预算管理
class TokenBudget {
  private usage: Map<string, number> = new Map();
  private limits: Map<string, number> = new Map();
  
  constructor(limits: Record<string, number>) {
    for (const [key, limit] of Object.entries(limits)) {
      this.limits.set(key, limit);
      this.usage.set(key, 0);
    }
  }
  
  canSpend(budgetKey: string, tokens: number): boolean {
    const current = this.usage.get(budgetKey) || 0;
    const limit = this.limits.get(budgetKey) || 0;
    return current + tokens <= limit;
  }
  
  spend(budgetKey: string, tokens: number): void {
    const current = this.usage.get(budgetKey) || 0;
    this.usage.set(budgetKey, current + tokens);
  }
  
  getRemaining(budgetKey: string): number {
    const limit = this.limits.get(budgetKey) || 0;
    const used = this.usage.get(budgetKey) || 0;
    return Math.max(0, limit - used);
  }
}
```

请求限流防止突发流量打垮系统。可以用令牌桶或漏桶算法，限制每秒钟的模型调用次数。限流可以分层：应用层限制总QPS，用户层限制单个用户的调用频率，模型层限制对特定模型的调用速率。

资源回收在长时间运行的Agent中很重要。Agent执行过程中可能创建临时文件、建立数据库连接、缓存中间结果。这些资源如果不在任务结束时释放，会造成泄漏。建议用资源池和自动清理机制。

```python
# 自动资源清理
from contextlib import asynccontextmanager

class ResourceManager:
    def __init__(self):
        self.resources = []
    
    def track(self, resource):
        self.resources.append(resource)
        return resource
    
    async def cleanup(self):
        for resource in reversed(self.resources):
            try:
                if hasattr(resource, 'close'):
                    await resource.close()
                elif hasattr(resource, 'cleanup'):
                    await resource.cleanup()
            except Exception as e:
                logger.warning(f"Resource cleanup failed: {e}")
        self.resources.clear()

@asynccontextmanager
async def agent_session():
    manager = ResourceManager()
    try:
        yield manager
    finally:
        await manager.cleanup()
```

## 缓存策略：减少重复计算

缓存是提升Agent性能最有效的手段之一。Agent任务中有很多重复或相似的操作，通过缓存可以避免重复计算。

提示词缓存适合结构化任务。如果同一个Skill总是被相似的输入调用，可以把常见输入的推理结果缓存起来。比如一个代码解释Skill，对于常见的库函数，结果通常是一致的。

```typescript
// 提示词结果缓存
class PromptCache {
  private cache: LRUCache<string, CacheEntry>;
  
  constructor(maxSize: number = 1000, ttlMs: number = 3600000) {
    this.cache = new LRUCache({ max: maxSize, ttl: ttlMs });
  }
  
  async getOrCompute(
    prompt: string,
    compute: () => Promise<string>
  ): Promise<string> {
    const key = this.hashPrompt(prompt);
    
    const cached = this.cache.get(key);
    if (cached && !this.isExpired(cached)) {
      return cached.result;
    }
    
    const result = await compute();
    this.cache.set(key, { result, timestamp: Date.now() });
    return result;
  }
  
  private hashPrompt(prompt: string): string {
    // 使用语义哈希而非精确匹配
    return createSemanticHash(prompt);
  }
}
```

向量检索缓存适合RAG类Agent。如果Agent需要频繁检索相同的知识库，可以把检索结果缓存起来。注意向量检索缓存的key应该是查询向量本身，而不是文本，因为相似的文本可能有不同的向量表示。

工具调用缓存对外部API调用特别有效。如果一个Skill需要查询天气、搜索网页或翻译文本，这些结果在短时间内不会变化，完全可以缓存。

```python
# 工具调用缓存装饰器
from functools import wraps
import hashlib
import json

def cached_tool(ttl_seconds=300):
    cache = {}
    
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = hashlib.sha256(
                json.dumps({'args': args, 'kwargs': kwargs}, sort_keys=True).encode()
            ).hexdigest()
            
            now = time.time()
            
            # 检查缓存
            if cache_key in cache:
                entry = cache[cache_key]
                if now - entry['timestamp'] < ttl_seconds:
                    return entry['result']
            
            # 执行并缓存
            result = await func(*args, **kwargs)
            cache[cache_key] = {
                'result': result,
                'timestamp': now
            }
            
            return result
        return wrapper
    return decorator

@cached_tool(ttl_seconds=600)
async def search_web(query: str) -> list[SearchResult]:
    # 实际搜索逻辑
    pass
```

缓存失效策略很重要。Agent系统的缓存不能简单按时间失效，因为不同数据的更新频率不同。建议给缓存条目打上内容类型标签，根据类型设置不同的TTL。敏感数据如用户信息缓存时间短，静态知识缓存时间长。

## 并发控制：平衡效率与稳定性

并发控制不当会导致资源争抢、死锁和性能下降。Agent系统的并发有两个层面：单个Agent内部的步骤并发，和多个Agent之间的系统级并发。

单个Agent内部，DAG中的并行步骤需要控制并发度。不是越多越好，因为模型推理和外部API通常有并发限制。建议根据下游服务的容量动态调整并发度。

```typescript
// 自适应并发控制
class AdaptiveConcurrency {
  private currentConcurrency: number = 4;
  private successRate: number = 1.0;
  private targetLatency: number = 2000; // 2秒
  
  async adjustMetrics(recentLatencies: number[], errors: number) {
    const avgLatency = mean(recentLatencies);
    const errorRate = errors / recentLatencies.length;
    
    if (avgLatency > this.targetLatency * 1.2 || errorRate > 0.1) {
      // 降低并发
      this.currentConcurrency = Math.max(1, this.currentConcurrency - 1);
    } else if (avgLatency < this.targetLatency * 0.8 && errorRate < 0.01) {
      // 提升并发
      this.currentConcurrency = Math.min(16, this.currentConcurrency + 1);
    }
    
    this.successRate = 1 - errorRate;
  }
  
  getConcurrency(): number {
    return this.currentConcurrency;
  }
}
```

系统级并发要考虑公平性。如果一个用户的Agent占用了所有资源，其他用户就会饿死。建议按用户分配资源配额，或者采用优先级调度，保证高优先级任务先执行。

## 监控指标：数据驱动的优化

没有监控的优化是盲目的。Agent系统需要关注的关键指标分为性能指标、质量指标和成本指标。

性能指标包括延迟分布、吞吐量、并发数和资源利用率。延迟不要只看平均值，P99和P999更重要，它们反映了最差情况下的用户体验。

```typescript
// 延迟监控
class LatencyMonitor {
  private histogram: Record<string, number[]> = {};
  
  record(operation: string, latencyMs: number) {
    if (!this.histogram[operation]) {
      this.histogram[operation] = [];
    }
    this.histogram[operation].push(latencyMs);
    
    // 只保留最近1000个样本
    if (this.histogram[operation].length > 1000) {
      this.histogram[operation] = this.histogram[operation].slice(-1000);
    }
  }
  
  getPercentile(operation: string, p: number): number {
    const samples = this.histogram[operation];
    if (!samples || samples.length === 0) return 0;
    
    const sorted = [...samples].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  
  getReport(): PerformanceReport {
    const report: PerformanceReport = {};
    
    for (const operation of Object.keys(this.histogram)) {
      report[operation] = {
        p50: this.getPercentile(operation, 50),
        p95: this.getPercentile(operation, 95),
        p99: this.getPercentile(operation, 99),
        avg: mean(this.histogram[operation]),
        count: this.histogram[operation].length
      };
    }
    
    return report;
  }
}
```

质量指标衡量Agent输出的好坏，包括准确率、用户满意度、任务完成率和重试次数。性能优化不能以牺牲质量为代价，监控质量指标可以及早发现"优化过度"的问题。

成本指标包括Token消耗、API调用次数、计算资源使用和存储占用。这些直接关系到运营成本，也是性能优化的经济约束。

建议建立性能基线。在系统正式上线前，记录关键指标的正常范围。后续优化时对比基线，确保改进是真实的而不是测量误差。

## 实际案例：客服Agent的性能优化

我们优化过一个电商客服Agent，目标是降低平均响应时间从15秒到5秒以内。

通过监控分析，发现主要瓶颈在三个地方。第一是知识库检索，每次用户提问都要做向量检索，平均耗时3秒。优化方案是引入检索缓存，对高频问题直接返回缓存结果，命中率达到了60%。同时把向量索引从远程服务迁移到本地内存，检索延迟降到了200毫秒。

第二是工具调用串行化。Agent判断用户意图后，要依次查询订单状态、库存信息和物流跟踪，每个调用2秒，串行就是6秒。优化方案是把这三个调用改为并行，同时引入工具调用缓存，同一订单的查询结果缓存30秒。优化后这个环节从6秒降到了2.5秒。

第三是模型调用过多。原始实现中，每个回复都要经过意图识别、信息检索、回复生成三次模型调用。优化方案是把意图识别和信息检索合并成一次调用，用更小的模型做初步筛选，只有复杂问题才用大模型生成回复。这样模型调用次数从平均3次降到了1.5次。

```python
# 优化前后的性能对比
optimization_results = {
    "knowledge_retrieval": {
        "before": {"avg_latency": 3000, "p99": 8000},
        "after": {"avg_latency": 200, "p99": 500},
        "improvement": "15x"
    },
    "tool_calls": {
        "before": {"avg_latency": 6000, "calls_per_request": 3},
        "after": {"avg_latency": 2500, "calls_per_request": 1.5},
        "improvement": "2.4x"
    },
    "model_invocations": {
        "before": {"avg_per_request": 3, "cost_per_request": 0.12},
        "after": {"avg_per_request": 1.5, "cost_per_request": 0.05},
        "improvement": "cost down 58%"
    },
    "overall": {
        "before": {"avg_response_time": 15000, "user_satisfaction": 3.2},
        "after": {"avg_response_time": 4200, "user_satisfaction": 4.5},
        "improvement": "3.6x faster, satisfaction +40%"
    }
}
```

最终平均响应时间降到了4.2秒，用户满意度从3.2提升到4.5，同时运营成本降低了58%。这个案例说明，Agent性能优化不是单一手段能解决的，需要系统性地分析和优化各个环节。

## 总结与最佳实践

Agent和Skill的性能优化需要系统思维，不能只看局部。以下是一些可以直接应用的最佳实践。

在延迟优化上，优先做流式输出和渐进式加载，让用户感知更快。预加载常用模型和Skill资源，减少冷启动时间。

在吞吐提升上，最大化DAG并行度，把没有依赖的步骤并行执行。批量处理相似请求，减少网络往返。用模型路由把任务分配给合适的模型。

在资源管理上，设置Token预算和请求限流，防止成本和容量失控。做好资源清理，避免连接泄漏和临时文件堆积。

在缓存策略上，按内容类型设计不同的缓存策略。提示词缓存减少重复推理，工具调用缓存减少外部依赖，向量检索缓存加速RAG。

在并发控制上，根据下游容量自适应调整并发度。系统级并发要考虑公平性和优先级，避免单个用户耗尽资源。

在监控上，建立性能基线，关注P99延迟而不仅是平均值。同时监控质量指标和成本指标，确保优化不以牺牲效果为代价。

性能优化是一个持续过程。随着用户量增长、功能增加和模型更新，瓶颈会转移。定期做性能审计，用数据驱动决策，而不是凭感觉优化。