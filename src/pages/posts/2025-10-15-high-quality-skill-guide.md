---
layout: ../../layouts/ArticleLayout.astro
title: "编写高质量Skill的10个黄金法则"
lang: "zh-CN"
pubDate: 2025-10-15
updatedDate: 2025-10-15
description: "从触发条件设计、流程编排、边界定义、错误处理、版本管理、测试策略、文档规范、性能优化、安全考虑和持续迭代十个维度，讲透高质量Skill的编写方法。"
author: "派"
tags: ["Skill开发", "最佳实践", "AI编程", "代码质量"]
draft: false
---

Skill是AI系统中的可复用能力单元。它决定了一个Agent能稳定完成什么任务、按什么标准完成、在什么边界内完成。好的Skill让Agent行为可预期，差的Skill让每次执行都像抽盲盒。这篇文章从十个维度，讲清楚怎么写出高质量的Skill。

## 法则一：触发条件要精确

Skill的触发条件回答一个核心问题：什么时候必须用这个Skill？条件太宽泛会导致误触发，Agent在不合适的场景调用不合适的Skill；条件太严格会导致漏触发，该用的时候没用上。

精确触发条件有两个要素：明确的信号和清晰的优先级。

明确的信号可以是用户意图、系统事件或上下文状态。比如"文章发布Skill"的触发信号是"用户确认文章已完成并要求发布"，而不是"用户提到发布"。后者太宽泛，用户可能只是询问发布流程，还没准备好发布。

清晰的优先级解决多个Skill触发条件重叠时的选择问题。比如"代码修复Skill"和"代码重构Skill"都可能在用户说"优化这段代码"时触发，但修复的优先级应该高于重构，因为修复处理的是功能问题，重构处理的是结构问题。

```typescript
interface TriggerCondition {
  signals: TriggerSignal[];
  priority: number; // 数字越小优先级越高
  exclusivity: boolean; // 是否排他，排他触发器激活时阻止低优先级触发器
}

const publishSkillTrigger: TriggerCondition = {
  signals: [
    { type: 'intent', pattern: /^(发布|deploy|publish).*文章/ },
    { type: 'event', name: 'article.completed' },
    { type: 'context', check: (ctx) => ctx.get('article.status') === 'ready' },
  ],
  priority: 1,
  exclusivity: true,
};
```

触发条件应该写在Skill的最前面，让调用方一眼就知道什么情况下该用这个Skill。不要把触发条件分散在文档各处。

## 法则二：流程编排要线性

Skill的核心是流程。流程定义了任务从输入到输出的完整路径。好的流程编排有一个关键特征：线性。

线性不是说没有分支，而是说主路径清晰。每个步骤有明确的输入来源、处理逻辑和输出去向。分支是例外处理，不是常态。

非线性流程的问题在于：Agent执行时容易迷失。一个Skill如果包含大量嵌套条件、循环和跳转，Agent很难跟踪当前在哪一步、下一步该做什么。尤其当上下文变长时，模型对复杂控制流的理解会下降。

推荐的做法是把流程写成检查表形式：

```text
## 文章发布流程

1. 验证输入
   - 检查frontmatter是否完整
   - 检查图片是否存在
   - 检查链接是否可访问

2. 生成SEO元数据
   - 生成description（150字符以内）
   - 确认title包含关键词
   - 检查slug格式

3. 构建验证
   - 运行pnpm build
   - 确认构建无错误
   - 确认输出目录正常

4. Git操作
   - 只stage修改的文件（不要git add .）
   - 写提交信息（包含改动摘要）
   - 推送前确认分支正确

5. 完成确认
   - 提供发布URL
   - 说明后续注意事项
```

这种格式对Agent和人类都友好。每个步骤有明确的前置条件和后置条件，执行时可以逐项检查。

## 法则三：边界定义要刚性

边界定义回答"这个Skill不会做什么"。很多人只写Skill会做什么，但更重要的是写清楚不会做什么。边界不清的Skill最容易越界，也最让调用方困惑。

边界应该包括三个维度：范围边界、权限边界和时间边界。

范围边界定义操作的数据范围。比如"数据库迁移Skill"的范围是"只修改schema目录下的文件，不动业务代码"。

权限边界定义允许和禁止的操作。比如"代码审查Skill"的权限边界是"只读，不修改任何文件"。

时间边界定义最大执行时长和超时行为。比如"API测试Skill"的时间边界是"单个请求最多5秒，整体最多30秒，超时视为失败"。

```typescript
interface SkillBoundary {
  scope: {
    include: string[]; // 允许操作的路径/模块
    exclude: string[]; // 明确排除的路径/模块
  };
  permissions: {
    read: boolean;
    write: boolean;
    execute: boolean;
    delete: boolean;
  };
  time: {
    maxDuration: number; // 毫秒
    timeoutAction: 'fail' | 'retry' | 'partial';
  };
}

const reviewBoundary: SkillBoundary = {
  scope: {
    include: ['src/'],
    exclude: ['node_modules/', 'dist/', '.git/'],
  },
  permissions: {
    read: true,
    write: false,
    execute: false,
    delete: false,
  },
  time: {
    maxDuration: 120000,
    timeoutAction: 'partial',
  },
};
```

边界应该在Skill的最前面明确声明，而不是散落在流程描述中。Agent在执行前应该先检查边界，而不是边做边发现越界。

## 法则四：错误处理要结构化

Skill执行不可能永远成功。网络超时、文件不存在、输入格式错误、依赖缺失，这些情况都会发生。关键不是避免错误，而是让错误信息对调用方有用。

非结构化的错误是这样的："操作失败了，可能是因为网络问题，请重试。"Agent拿到这段文字，不知道该怎么办。是重试？换种方式？还是上报用户？

结构化的错误应该包含：错误类型、严重程度、是否可恢复、恢复建议、相关上下文。

```typescript
interface SkillError {
  type: 'input_invalid' | 'dependency_missing' | 'timeout' | 'permission_denied' | 'unknown';
  severity: 'fatal' | 'recoverable' | 'warning';
  recoverable: boolean;
  message: string;
  suggestion: string;
  context: {
    step: string; // 哪个步骤出错
    input: unknown; // 当时的输入
    partialResult?: unknown; // 已完成的中间结果
  };
}

// 示例错误
const timeoutError: SkillError = {
  type: 'timeout',
  severity: 'recoverable',
  recoverable: true,
  message: 'API请求超时',
  suggestion: '检查网络连接后重试，或增加超时时间到10秒',
  context: {
    step: 'fetch-user-data',
    input: { userId: '12345', endpoint: '/api/users/12345' },
    partialResult: null,
  },
};
```

有了结构化错误，Agent可以制定恢复策略：输入无效时提示用户修正；超时时自动重试；权限不足时上报并等待授权。而不是每次都把一段自然语言错误扔给用户。

## 法则五：版本管理要显式

Skill会演进。今天的要求可能明天就变了。如果没有版本管理，Agent可能调用了一个旧版本的Skill，或者新旧版本行为不一致导致结果混乱。

版本管理不是简单的v1、v2、v3。好的版本管理包含：版本号、变更日志、兼容性声明和迁移指南。

```yaml
skill: article-publish
version: 2.1.0
changelog:
  - version: 2.1.0
    date: 2025-10-10
    changes:
      - "新增：支持多语言文章发布"
      - "修改：构建命令从npm改为pnpm"
    breaking: false
  - version: 2.0.0
    date: 2025-09-01
    changes:
      - "重构：拆分为独立子流程"
    breaking: true
    migration: "调用方需要按新接口传入参数"

compatibility:
  minimumAgentVersion: "1.5.0"
  deprecated: false
```

版本号遵循语义化版本：主版本号变更是破坏性更新，次版本号变更是新增功能，修订号变更是bug修复。

Agent在调用Skill前应该检查版本兼容性。如果Agent版本低于Skill要求的最低版本，应该拒绝调用或降级处理。

## 法则六：测试策略要分层

Skill需要测试，但测试方式与常规代码不同。因为Skill的行为很大程度上依赖LLM，而LLM的输出有一定随机性。所以需要分层测试策略。

第一层是契约测试。验证Skill的输入输出是否符合接口定义。给固定输入，检查输出schema是否正确，必填字段是否都存在。这层测试不验证业务正确性，只验证格式正确性。

```typescript
describe('ArticlePublishSkill Contract', () => {
  it('should return valid result schema', async () => {
    const result = await skill.execute({
      articlePath: 'test-article.md',
    });
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('warnings');
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('should reject invalid input', async () => {
    await expect(skill.execute({})).rejects.toMatchObject({
      type: 'input_invalid',
    });
  });
});
```

第二层是场景测试。验证Skill在典型场景下的行为。比如"文章发布Skill"的场景测试包括：正常发布、缺少frontmatter、构建失败、git冲突。每个场景给典型输入，验证输出是否符合预期。

第三层是对抗测试。故意给异常输入，验证Skill是否能优雅处理。比如空字符串、超长内容、特殊字符、不存在的文件路径。对抗测试发现的是Skill的鲁棒性边界。

```typescript
describe('ArticlePublishSkill Edge Cases', () => {
  it('should handle missing frontmatter gracefully', async () => {
    const result = await skill.execute({
      articlePath: 'no-frontmatter.md',
    });
    expect(result.success).toBe(false);
    expect(result.error.type).toBe('input_invalid');
  });

  it('should handle very long title', async () => {
    const result = await skill.execute({
      articlePath: 'long-title.md',
    });
    expect(result.warnings).toContain(expect.stringMatching(/title.*too long/));
  });
});
```

测试不是一次性的。每次修改Skill后都要跑测试，确保没有破坏已有行为。

## 法则七：文档规范要统一

Skill的文档不是给人类读的散文，而是给Agent读的说明书。文档应该包含：触发条件、输入格式、输出格式、执行流程、边界约束、错误类型和示例。

文档格式推荐用结构化模板，而不是自由文本。结构化文档更容易被Agent解析，也更容易维护。

```markdown
# Skill: 文章发布

## 触发条件
- 用户明确要求发布文章
- 文章状态为"已完成"且用户确认发布

## 输入
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| articlePath | string | 是 | 文章文件路径 |
| skipBuild | boolean | 否 | 是否跳过构建验证，默认false |

## 输出
| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 是否成功 |
| url | string | 发布后的URL |
| warnings | string[] | 警告信息 |
| error | ErrorInfo | 错误信息（失败时） |

## 执行流程
1. 验证输入和文章完整性
2. 生成SEO元数据
3. 运行构建
4. 执行Git操作
5. 返回结果

## 边界
- 只操作指定文章文件
- 不修改其他文章
- 构建失败时停止

## 错误类型
- input_invalid: 输入参数错误
- build_failed: 构建失败
- git_error: Git操作失败

## 示例
输入: `{ "articlePath": "hello-world.md" }`
输出: `{ "success": true, "url": "/blog/hello-world" }`
```

文档应该与代码一起维护。修改Skill时同步更新文档，文档与实现不一致是Skill最常见的腐化原因。

## 法则八：性能优化要度量

Skill的性能问题通常不在计算，而在延迟。因为每个步骤可能涉及LLM调用，而LLM调用是秒级的。一个Skill如果包含五个步骤，每个步骤一次LLM调用，总延迟可能超过十秒。

优化策略有三个方向：并行化、缓存和降级。

并行化是把没有依赖的步骤同时执行。比如"文章发布Skill"中，SEO元数据生成和图片压缩可以并行，因为它们互不依赖。

```typescript
// 串行：总延迟 = t1 + t2
const seo = await generateSEO(article);
const compressed = await compressImages(article.images);

// 并行：总延迟 = max(t1, t2)
const [seo, compressed] = await Promise.all([
  generateSEO(article),
  compressImages(article.images),
]);
```

缓存是避免重复计算。如果Skill的输入没变，结果应该复用。比如"代码审查Skill"对同一组文件的审查结果可以缓存，除非文件内容变化。

```typescript
class CachedSkill implements Skill {
  private cache = new Map<string, CacheEntry>();

  async execute(params: SkillParams): Promise<SkillResult> {
    const key = this.hash(params);
    const cached = this.cache.get(key);
    if (cached && !this.isExpired(cached)) {
      return cached.result;
    }
    const result = await this.baseSkill.execute(params);
    this.cache.set(key, { result, timestamp: Date.now() });
    return result;
  }
}
```

降级是在资源不足时提供简化版结果。比如"详细审查Skill"超时后，降级为"快速扫描Skill"，只检查最严重的问题。

性能优化要以度量为基础。记录每个Skill的执行时间、LLM调用次数、缓存命中率，找到真正的瓶颈再优化。

## 法则九：安全考虑要前置

Skill通常有操作真实系统的能力：读写文件、执行命令、调用API、操作数据库。这种能力如果滥用，后果严重。

安全考虑要从设计阶段就开始，而不是事后补救。三个关键措施：权限最小化、输入校验和操作审计。

权限最小化是只给Skill完成工作所需的最小权限。比如"文章发布Skill"只需要读写文章目录和git操作，不需要访问数据库或系统配置。

输入校验是拒绝一切可疑输入。不要相信调用方传进来的任何数据，都要校验格式、长度、范围和来源。比如文件路径不能包含".."。

```typescript
function validatePath(inputPath: string): string {
  const normalized = path.normalize(inputPath);
  if (normalized.includes('..')) {
    throw new SkillError('invalid_input', '路径包含非法字符');
  }
  if (!normalized.startsWith(ALLOWED_BASE_PATH)) {
    throw new SkillError('invalid_input', '路径超出允许范围');
  }
  return normalized;
}
```

操作审计是记录Skill的所有操作，包括读写了什么文件、执行了什么命令、调用了什么API。审计日志不仅用于事后追溯，也可以用于异常检测：如果一个Skill突然开始访问不相关的文件，可能是被劫持了。

```typescript
class AuditedSkill implements Skill {
  async execute(params: SkillParams): Promise<SkillResult> {
    const auditLog = new AuditLog({ skillId: this.id, timestamp: Date.now() });
    try {
      const result = await this.baseSkill.execute(params);
      auditLog.record('success', result);
      return result;
    } catch (error) {
      auditLog.record('failure', error);
      throw error;
    } finally {
      await auditLog.save();
    }
  }
}
```

## 法则十：持续迭代要闭环

Skill不是写完就完的。真实使用中发现的问题、用户反馈、执行日志，都是改进Skill的素材。关键要建立闭环：执行、观察、分析、改进。

执行阶段要记录详细的运行数据：输入参数、执行步骤、中间结果、最终输出、执行时间、错误信息。

观察阶段要定期审查这些数据。哪些步骤经常失败？哪些输入导致意外结果？执行时间是否有异常波动？

分析阶段要找出模式。如果80%的失败都在输入校验步骤，说明输入规格可能不清晰；如果某个步骤总是超时，说明流程可能需要拆分或优化。

改进阶段要基于分析做调整。但不要盲目修改，每次修改都要有明确目标和验证方式。修改后跑测试，监控指标变化。

```typescript
interface SkillMetrics {
  executionCount: number;
  successRate: number;
  averageDuration: number;
  errorBreakdown: Record<string, number>;
  inputPatterns: Record<string, number>;
}

// 定期生成报告
function generateSkillReport(metrics: SkillMetrics): ImprovementSuggestion[] {
  const suggestions = [];
  
  if (metrics.successRate < 0.95) {
    suggestions.push({
      type: 'reliability',
      message: `成功率${metrics.successRate}%，建议检查错误分布`,
      priority: 'high',
    });
  }
  
  const topError = Object.entries(metrics.errorBreakdown)
    .sort((a, b) => b[1] - a[1])[0];
  if (topError && topError[1] / metrics.executionCount > 0.1) {
    suggestions.push({
      type: 'error_focus',
      message: `${topError[0]}占比过高，建议针对性优化`,
      priority: 'medium',
    });
  }
  
  return suggestions;
}
```

Skill的质量不是一次达到的，而是在持续迭代中逐步提高的。建立度量、分析和改进的闭环，是让Skill从"能用"走向"好用"的关键。

## 总结

编写高质量Skill的十个法则可以归纳为一句话：让Skill的意图清晰、行为可预期、边界可控制、错误可恢复、演进可持续。

触发条件精确，避免误触发和漏触发。流程编排线性，让执行路径清晰。边界定义刚性，防止越界操作。错误处理结构化，让调用方能恢复。版本管理显式，避免兼容性混乱。测试策略分层，覆盖契约、场景和边界。文档规范统一，人读Agent也读得懂。性能优化有度，并行缓存和降级三管齐下。安全考虑前置，权限最小化和审计不可少。持续迭代闭环，度量分析改进缺一不可。

这十个法则不是教条，而是实践中反复验证有效的经验。不同场景下权重不同，但每个都值得认真思考。当你写下一个Skill时，不妨对照这十条检查一遍。它可能帮你避免很多未来的麻烦。
