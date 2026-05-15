---
layout: ../../layouts/ArticleLayout.astro
title: "Prompt工程在Skill设计中的应用"
lang: "zh-CN"
pubDate: 2026-02-04
updatedDate: 2026-02-04
description: "探讨如何将Prompt工程技术系统性地融入Skill设计，包括模板化、上下文组装、少样本学习和结构化输出等方法论。"
author: "派"
tags: ["Prompt工程", "Skill设计", "提示词优化", "AI应用"]
draft: false
---

Prompt工程不只是写一段好提示词，而是一门关于如何与AI有效沟通的系统学科。当Prompt工程遇上Skill设计，事情变得更有意思：Skill是反复使用的操作手册，Prompt是让AI执行操作的指令。两者的结合点在于，如何把Prompt工程的最佳实践固化到Skill里，让每次调用都稳定产出高质量结果。

Skill设计的核心挑战不是"怎么写一段好Prompt"，而是"怎么写一段能重复用好、能被不同AI理解、能在各种场景下保持稳定的Prompt"。这篇文章会从Prompt模板、变量注入、上下文组装、少样本学习、思维链、结构化输出和A/B测试七个方面，讲清楚Prompt工程在Skill设计中的具体应用。

## Prompt模板：从即兴创作到标准化生产

没有模板的Prompt就像每次做饭都凭感觉放盐：有时候刚好，有时候咸得要命。Skill作为可复用的能力单元，它的Prompt必须基于模板。模板的作用是定义Prompt的结构和固定部分，让可变部分通过变量注入。

一个典型的Skill Prompt模板通常包含这几个部分：角色定义、任务描述、输入格式、处理规则、输出格式、约束条件和示例。不是每个Skill都需要全部七个部分，但少了任何一个，都可能在某些场景下出问题。

```yaml
# Skill Prompt 模板结构
system:
  role: "你是一位专业的代码审查员"
  expertise: ["TypeScript", "React", "性能优化"]
  style: "直接、具体、以风险为导向"

task:
  description: "审查给定的代码变更，识别潜在问题"
  scope: "只关注{{review_scope}}范围内的文件"
  
input:
  format: |
    文件路径：{{file_path}}
    变更类型：{{change_type}}
    代码差异：
    ```diff
    {{diff_content}}
    ```

rules:
  - "优先识别安全风险和数据泄漏"
  - "关注性能瓶颈和内存泄漏"
  - "检查错误处理是否完善"
  - "验证边界条件覆盖"
  
output:
  format: "JSON"
  schema:
    type: "object"
    properties:
      findings:
        type: "array"
        items:
          type: "object"
          properties:
            severity: { enum: ["critical", "high", "medium", "low"] }
            category: { enum: ["security", "performance", "correctness", "maintainability"] }
            description: { type: "string" }
            suggestion: { type: "string" }
            line_numbers: { type: "array", items: { type: "number" } }
      summary: { type: "string" }
      risk_level: { enum: ["high", "medium", "low"] }

constraints:
  - "不要评论代码风格问题"
  - "必须引用具体的行号"
  - "优先讲风险，其次讲改进建议"
```

模板的好处显而易见。首先，它把Prompt的组织方式标准化了。同一个团队的不同Skill，遵循相同的模板结构，阅读和维护成本大幅降低。其次，它把固定内容和可变内容分离。角色定义、处理规则、约束条件通常是固定的，输入数据和范围则是每次调用时注入的。

变量注入不是简单的字符串替换。好的模板引擎应该支持条件渲染、默认值、列表展开和嵌套引用。比如有些约束只在特定条件下生效，有些规则在调试模式下需要展开详细说明。

```typescript
interface TemplateEngine {
  render(template: string, variables: Record<string, unknown>): string;
}

class SkillTemplateEngine implements TemplateEngine {
  render(template: string, variables: Record<string, unknown>): string {
    // 支持 {{variable}} 基本替换
    // 支持 {{#if condition}}...{{/if}} 条件渲染
    // 支持 {{#each items}}...{{/each}} 列表展开
    // 支持 {{variable | default("fallback")}} 默认值
    return this.processTemplate(template, variables);
  }

  private processTemplate(template: string, variables: Record<string, unknown>): string {
    // 实现模板处理逻辑
    // 处理变量替换
    let result = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      return value !== undefined ? String(value) : match;
    });

    // 处理条件块
    result = result.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (match, condition, content) => {
        return variables[condition] ? content : '';
      }
    );

    return result;
  }
}
```

## 变量注入：让Prompt从静态走向动态

静态Prompt的问题是缺乏灵活性。一个代码审查Skill不可能每次审查同样的文件，一个数据分析Skill也不可能每次处理同样的数据集。变量注入让Skill能够根据具体任务动态生成Prompt。

变量可以来自多个来源：用户输入、运行时上下文、配置文件、前序步骤的输出。Skill设计时要明确每个变量的来源、类型、约束和默认值。

```typescript
interface VariableDefinition {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  source: "user_input" | "context" | "config" | "previous_step";
  required: boolean;
  default?: unknown;
  validation?: ValidationRule[];
  description: string;
}

const reviewSkillVariables: VariableDefinition[] = [
  {
    name: "file_path",
    type: "string",
    source: "context",
    required: true,
    description: "要审查的文件路径"
  },
  {
    name: "diff_content",
    type: "string",
    source: "previous_step",
    required: true,
    description: "Git diff 格式的代码变更内容"
  },
  {
    name: "review_scope",
    type: "string",
    source: "config",
    required: false,
    default: "all",
    description: "审查范围：all、security、performance"
  },
  {
    name: "strict_mode",
    type: "boolean",
    source: "user_input",
    required: false,
    default: false,
    description: "是否启用严格模式，增加检查项"
  }
];
```

变量注入时要注意类型安全。一个被声明为数字的变量，如果注入了字符串，可能导致Prompt语义完全改变。Skill框架应该在注入前做类型检查和转换。

另一个常见问题是注入内容过长。如果用户传入了一个一万行的diff，直接注入会让Prompt超出模型的上下文窗口。这时候需要摘要、截断或分块处理。

```typescript
function injectVariable(
  prompt: string,
  variable: VariableDefinition,
  value: unknown,
  maxLength: number = 4000
): string {
  let processedValue: string;

  if (typeof value === "string" && value.length > maxLength) {
    // 对长文本进行智能截断
    processedValue = smartTruncate(value, maxLength);
  } else {
    processedValue = JSON.stringify(value);
  }

  const placeholder = `{{${variable.name}}}`;
  return prompt.replace(placeholder, processedValue);
}

function smartTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  // 保留开头和结尾，中间用省略号连接
  const headLength = Math.floor(maxLength * 0.6);
  const tailLength = Math.floor(maxLength * 0.3);

  return `${text.slice(0, headLength)}\n\n... [中间省略 ${text.length - headLength - tailLength} 字符] ...\n\n${text.slice(-tailLength)}`;
}
```

## 上下文组装：不是所有信息都要告诉AI

Agent执行任务时，往往掌握了大量上下文信息：项目结构、历史对话、用户偏好、系统状态、前序步骤的输出。把所有信息都塞进Prompt，既浪费Token，又会稀释关键信号的浓度。上下文组装的艺术在于：只给AI它需要的信息，按重要性排序，让AI第一眼就能看到关键内容。

上下文组装通常遵循"倒金字塔"原则：最重要的信息放在最前面，次要信息依次排列，背景信息放在最后。这和新闻写作的结构一样，因为AI读取Prompt的方式和人类读文章类似：注意力在前几句最集中。

```typescript
interface ContextAssembler {
  assemble(context: ExecutionContext): string;
}

class HierarchicalContextAssembler implements ContextAssembler {
  assemble(context: ExecutionContext): string {
    const parts: string[] = [];

    // 第一层：任务指令（最高优先级）
    parts.push(this.formatTaskInstruction(context.task));

    // 第二层：关键约束（不可违反的规则）
    if (context.constraints.length > 0) {
      parts.push(this.formatConstraints(context.constraints));
    }

    // 第三层：输入数据（本次处理的内容）
    parts.push(this.formatInput(context.input));

    // 第四层：相关历史（前序步骤的关键结果）
    if (context.history.length > 0) {
      parts.push(this.formatRelevantHistory(context.history));
    }

    // 第五层：背景信息（项目结构、术语表等）
    if (context.background) {
      parts.push(this.formatBackground(context.background));
    }

    return parts.join("\n\n");
  }

  private formatTaskInstruction(task: Task): string {
    return `## 任务\n${task.description}\n`;
  }

  private formatConstraints(constraints: Constraint[]): string {
    const items = constraints.map(c => `- ${c.description}`).join("\n");
    return `## 约束条件（必须遵守）\n${items}\n`;
  }

  private formatInput(input: unknown): string {
    return `## 输入数据\n${JSON.stringify(input, null, 2)}\n`;
  }

  private formatRelevantHistory(history: HistoryItem[]): string {
    const relevant = history
      .filter(h => h.importance === "high")
      .map(h => `- ${h.step}: ${h.summary}`)
      .join("\n");
    return `## 相关历史\n${relevant}\n`;
  }

  private formatBackground(background: BackgroundInfo): string {
    return `## 背景信息\n${background.summary}\n`;
  }
}
```

上下文组装还要考虑时效性。一个三天前的对话记录，可能对当前任务毫无意义，甚至会误导AI。Skill应该根据任务类型，定义上下文的有效期和相关性评分规则。

## 少样本学习：用例子教AI做事

少样本学习（Few-shot Learning）是Prompt工程中最有效的技巧之一。它的原理很简单：给AI几个输入和期望输出的例子，让它照着样子做。这比单纯用文字描述规则更直观，尤其对于那些难以精确形式化的任务。

在Skill设计中，少样本示例应该作为模板的固定部分，随Skill一起分发。示例的选择很重要：要覆盖主要场景，要展示边界情况，要包含正反两面的例子。

```text
## 示例

### 示例1：简单的类型错误
输入：
```typescript
function greet(name: string) {
  return "Hello, " + name.toUppercase();
}
```
输出：
```json
{
  "findings": [
    {
      "severity": "medium",
      "category": "correctness",
      "description": "调用了不存在的方法 toUppercase，正确方法名应为 toUpperCase",
      "suggestion": "将 name.toUppercase() 改为 name.toUpperCase()",
      "line_numbers": [2]
    }
  ],
  "summary": "存在一个拼写错误导致的类型问题",
  "risk_level": "low"
}
```

### 示例2：安全漏洞
输入：
```typescript
app.get("/user", (req, res) => {
  const query = `SELECT * FROM users WHERE id = ${req.query.id}`;
  db.execute(query).then(users => res.json(users));
});
```
输出：
```json
{
  "findings": [
    {
      "severity": "critical",
      "category": "security",
      "description": "SQL注入漏洞：用户输入直接拼接到SQL查询中",
      "suggestion": "使用参数化查询，如 db.execute('SELECT * FROM users WHERE id = ?', [req.query.id])",
      "line_numbers": [2, 3]
    }
  ],
  "summary": "发现严重的SQL注入安全风险，需要立即修复",
  "risk_level": "high"
}
```
```

少样本示例的数量有讲究。太少不足以展示模式，太多会占用宝贵的上下文窗口。通常3到5个精心挑选的例子效果最好。示例应该多样化，覆盖不同类型的输入和输出格式。

示例的质量比数量更重要。一个模糊的、有歧义的示例，会让AI学到错误模式。每个示例都要有明确的输入、输出和解释，让AI理解"为什么这样输出"。

## 思维链：让AI展示思考过程

思维链（Chain of Thought）是一种让AI在给出最终答案之前，先展示推理过程的技巧。这对于复杂任务特别有用，因为它让AI的决策过程变得透明，也更容易调试和优化。

在Skill设计中，思维链通常通过两种方式实现：显式要求AI列出思考步骤，或者在系统提示中嵌入"先分析，后回答"的指令。

```text
## 思考流程

在给出最终回答之前，请按以下步骤思考：

1. 理解需求：明确用户想要什么，是否有隐含要求
2. 分析输入：检查输入数据的完整性、格式和潜在问题
3. 制定方案：列出可行的处理方法，比较优缺点
4. 执行处理：按照选定方案处理数据
5. 验证结果：检查结果是否符合预期，是否有遗漏
6. 总结输出：用清晰的方式呈现最终结果

请在回复中先展示你的思考过程，用 ---THOUGHT--- 标记开始，
用 ---END THOUGHT--- 标记结束。然后用 ---OUTPUT--- 标记开始输出最终结果。
```

思维链的好处是显而易见的。首先，它迫使AI进行结构化思考，减少跳步和遗漏。其次，当AI输出错误结果时，可以通过查看思维链定位问题出在哪一步。最后，思维链的输出可以作为训练数据，用于进一步优化模型或Skill。

不过，思维链也有成本。它增加了输出长度，消耗更多Token，也延长了响应时间。对于简单任务，强制使用思维链反而是负担。好的Skill设计应该根据任务复杂度，动态决定是否启用思维链。

```typescript
interface ThinkingModeConfig {
  enabled: boolean;
  complexityThreshold: number;  // 复杂度阈值，超过才启用
  maxThinkingSteps: number;
  requiredSteps: string[];
}

function shouldEnableThinking(
  task: Task,
  config: ThinkingModeConfig
): boolean {
  if (!config.enabled) return false;

  const complexity = estimateComplexity(task);
  return complexity >= config.complexityThreshold;
}

function estimateComplexity(task: Task): number {
  let score = 0;
  score += task.inputSize > 1000 ? 2 : 0;
  score += task.requiresReasoning ? 2 : 0;
  score += task.hasMultipleSteps ? 1 : 0;
  score += task.ambiguousRequirements ? 1 : 0;
  return score;
}
```

## 结构化输出：从自由文本到机器可读

让AI输出自由文本很容易，但让AI输出结构化的、可解析的数据很难。而Skill的执行结果往往需要被后续步骤消费，所以结构化输出是Skill设计的关键能力。

结构化输出有几种实现方式。最简单的是在Prompt里明确要求输出JSON格式，并给出Schema定义。这种方式对小模型效果不错，对大模型基本够用。

```text
## 输出格式

你必须以JSON格式输出结果，严格遵循以下Schema：

{
  "type": "object",
  "properties": {
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "severity": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
          "category": { "type": "string", "enum": ["security", "performance", "correctness", "maintainability"] },
          "description": { "type": "string", "maxLength": 500 },
          "suggestion": { "type": "string", "maxLength": 500 },
          "line_numbers": { "type": "array", "items": { "type": "number" } }
        },
        "required": ["severity", "category", "description"]
      }
    },
    "summary": { "type": "string", "maxLength": 1000 },
    "risk_level": { "type": "string", "enum": ["high", "medium", "low"] }
  },
  "required": ["findings", "summary", "risk_level"]
}

注意：
- 不要输出JSON之外的任何内容
- 所有字符串必须使用双引号
- 数组可以为空，但字段不能省略
- line_numbers 必须是准确的整数
```

但这种方式有个问题：AI偶尔会输出一些JSON之外的内容，比如解释性文字、Markdown标记、或者格式不完整的JSON。为了解决这个问题，可以结合输出解析和修复策略。

```typescript
interface StructuredOutputParser<T> {
  schema: JSONSchema;
  parse(raw: string): T;
  validate(data: unknown): ValidationResult;
}

class JSONOutputParser<T> implements StructuredOutputParser<T> {
  constructor(
    public schema: JSONSchema,
    private maxRepairAttempts: number = 3
  ) {}

  parse(raw: string): T {
    // 第一步：尝试直接解析
    try {
      const cleaned = this.extractJSON(raw);
      const parsed = JSON.parse(cleaned);
      const validation = this.validate(parsed);
      if (validation.valid) {
        return parsed as T;
      }
      // 验证失败，尝试修复
      return this.attemptRepair(parsed, validation.errors);
    } catch (error) {
      // 解析失败，尝试更激进的修复
      return this.attemptAggressiveRepair(raw);
    }
  }

  private extractJSON(raw: string): string {
    // 尝试提取 JSON 代码块
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) return codeBlockMatch[1].trim();

    // 尝试匹配最外层的大括号
    const jsonMatch = raw.match(/(\{[\s\S]*\})/);
    if (jsonMatch) return jsonMatch[1].trim();

    return raw.trim();
  }

  private attemptRepair(parsed: unknown, errors: ValidationError[]): T {
    // 根据验证错误尝试修复
    let repaired = parsed;
    for (const error of errors) {
      repaired = this.applyFix(repaired, error);
    }
    return repaired as T;
  }

  private attemptAggressiveRepair(raw: string): T {
    // 更激进的修复策略
    // 移除所有非JSON内容，补全缺失的括号等
    let cleaned = raw.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
    return JSON.parse(cleaned) as T;
  }

  validate(data: unknown): ValidationResult {
    // 使用 JSON Schema 验证
    return validateAgainstSchema(data, this.schema);
  }

  private applyFix(data: unknown, error: ValidationError): unknown {
    // 根据错误类型应用修复
    return data;
  }
}
```

对于支持函数调用的模型，更好的方式是使用Function Calling或Tool Use API。这种方式下，模型直接输出结构化的函数调用参数，不需要从自由文本中解析JSON。准确率更高，格式更稳定。

## A/B测试：用数据说话

Prompt工程最怕的就是"我觉得这个版本更好"。人的直觉在评估Prompt质量时很不靠谱。同一个Prompt，换一批测试用例，效果可能就完全不同。A/B测试是优化Prompt的唯一可靠方法。

在Skill设计中，A/B测试意味着维护多个Prompt版本，用相同的测试集评估它们的表现，然后用数据决定哪个版本更好。

```typescript
interface PromptVariant {
  id: string;
  name: string;
  template: string;
  metadata: {
    createdAt: Date;
    hypothesis: string;  // 这个变体想验证什么假设
  };
}

interface TestCase {
  id: string;
  input: unknown;
  expectedOutput?: unknown;
  evaluationCriteria: EvaluationCriterion[];
}

interface EvaluationCriterion {
  name: string;
  weight: number;
  evaluate(actual: unknown, expected?: unknown): number;  // 返回0-1的分数
}

class PromptABTest {
  constructor(
    private variants: PromptVariant[],
    private testCases: TestCase[]
  ) {}

  async run(): Promise<TestResult> {
    const results: VariantResult[] = [];

    for (const variant of this.variants) {
      const caseResults: CaseResult[] = [];

      for (const testCase of this.testCases) {
        // 渲染Prompt
        const prompt = this.renderVariant(variant, testCase.input);

        // 调用模型
        const response = await this.callModel(prompt);

        // 评估结果
        const scores = testCase.evaluationCriteria.map(criterion => ({
          criterion: criterion.name,
          score: criterion.evaluate(response, testCase.expectedOutput),
          weight: criterion.weight
        }));

        const weightedScore = scores.reduce(
          (sum, s) => sum + s.score * s.weight,
          0
        ) / scores.reduce((sum, s) => sum + s.weight, 0);

        caseResults.push({
          testCaseId: testCase.id,
          scores,
          weightedScore,
          response
        });
      }

      const averageScore = caseResults.reduce(
        (sum, r) => sum + r.weightedScore,
        0
      ) / caseResults.length;

      results.push({
        variantId: variant.id,
        variantName: variant.name,
        averageScore,
        caseResults
      });
    }

    // 按平均分排序
    results.sort((a, b) => b.averageScore - a.averageScore);

    return {
      variants: results,
      winner: results[0],
      timestamp: new Date()
    };
  }

  private renderVariant(variant: PromptVariant, input: unknown): string {
    // 使用模板引擎渲染
    return templateEngine.render(variant.template, { input });
  }

  private async callModel(prompt: string): Promise<unknown> {
    // 调用底层模型API
    return modelClient.complete(prompt);
  }
}
```

测试用例的设计是A/B测试成败的关键。测试集要覆盖Skill的主要使用场景，要包含边界情况，要有明确的成功标准。评估标准可以是客观的（比如输出是否合法JSON、字段是否完整），也可以是主观的（比如由人工或更强的模型打分）。

A/B测试不是一次性的。Skill上线后，要持续收集真实使用数据，定期跑回归测试。当发现新的失败模式时，要把对应的用例加入测试集，防止 regression。

## 实际案例：智能客服Skill的Prompt工程

让我们通过一个实际案例，看看上述技术如何综合运用。假设我们要为一个电商网站设计一个智能客服Skill，它需要理解用户问题，查询订单状态，处理退换货请求，并在必要时转接人工。

首先，设计Prompt模板：

```yaml
system:
  role: "你是一位专业的电商客服助手"
  expertise: ["订单查询", "退换货政策", "物流跟踪", "产品咨询"]
  style: "友好、专业、高效"
  constraints:
    - "不要编造订单信息"
    - "不确定时主动询问用户"
    - "退换货必须符合平台政策"
    - "涉及敏感操作时需验证用户身份"

task:
  description: "处理用户的客服请求"
  
input:
  user_message: "用户输入的消息"
  conversation_history: "最近5轮对话记录"
  user_context:
    user_id: "用户ID"
    vip_level: "会员等级"
    recent_orders: "最近3个订单摘要"

available_tools:
  - name: "query_order"
    description: "查询订单详情"
  - name: "request_refund"
    description: "发起退款申请"
  - name: "check_inventory"
    description: "查询商品库存"
  - name: "transfer_to_human"
    description: "转接人工客服"

output:
  format: "JSON"
  schema:
    type: "object"
    properties:
      response_type:
        type: "string"
        enum: ["answer", "tool_call", "clarification", "escalation"]
      message: { type: "string" }
      tool_call: { type: "object" }
      confidence: { type: "number" }
```

然后，注入变量时组装上下文：

```typescript
function assembleCustomerServiceContext(
  userMessage: string,
  history: Message[],
  userProfile: UserProfile
): string {
  const parts: string[] = [];

  // 任务指令
  parts.push(`用户消息：${userMessage}`);

  // 用户上下文
  parts.push(`用户ID：${userProfile.userId}`);
  parts.push(`会员等级：${userProfile.vipLevel}`);
  parts.push(`最近订单：\n${formatOrders(userProfile.recentOrders)}`);

  // 相关历史（只保留最近的3轮）
  const relevantHistory = history.slice(-3);
  if (relevantHistory.length > 0) {
    parts.push(`对话历史：\n${formatHistory(relevantHistory)}`);
  }

  // 可用工具
  parts.push(`可用工具：\n- query_order: 查询订单详情\n- request_refund: 发起退款\n- check_inventory: 查询库存\n- transfer_to_human: 转人工`);

  return parts.join("\n\n");
}
```

少样本示例教AI处理不同场景：

```text
## 示例

示例1：查询订单
输入：我的订单怎么还没送到？
输出：
```json
{
  "response_type": "tool_call",
  "message": "我来帮您查询一下订单状态",
  "tool_call": {
    "name": "query_order",
    "parameters": { "user_id": "{{user_id}}", "recent": true }
  },
  "confidence": 0.95
}
```

示例2：请求退款（符合条件）
输入：这个手机我想退货
输出：
```json
{
  "response_type": "tool_call",
  "message": "好的，我帮您发起退款申请。请确认是最近购买的iPhone 15 Pro吗？",
  "tool_call": {
    "name": "request_refund",
    "parameters": { "order_id": "最近的iPhone订单ID", "reason": "用户主动退货" }
  },
  "confidence": 0.88
}
```

示例3：模糊请求
输入：这东西有问题
输出：
```json
{
  "response_type": "clarification",
  "message": "抱歉，请问您是指哪个订单的商品呢？另外具体遇到了什么问题？",
  "confidence": 0.6
}
```
```

这个案例展示了Prompt工程的完整流程：模板定义结构，变量注入动态数据，上下文组装控制信息量，少样本学习提供行为模式，结构化输出确保结果可用。通过A/B测试，我们可以不断优化模板和示例，提升Skill的准确率和用户体验。

## 总结与最佳实践

Prompt工程在Skill设计中的应用，本质上是把"如何与AI沟通"的经验沉淀为可复用的资产。以下是一些关键的最佳实践：

**模板优先，手写为辅**。所有Skill的Prompt都应该基于模板。模板不仅提高一致性，还能支持版本管理、A/B测试和动态注入。

**变量类型安全**。定义每个变量的类型、来源和约束，在注入前做验证和转换。不要让原始用户输入直接进Prompt。

**上下文分层**。按重要性组织上下文信息，最重要的放最前面。定期清理过期信息，避免上下文窗口被垃圾填满。

**示例要精选**。少样本示例贵精不贵多。每个示例都要展示一个有价值的模式，覆盖不同的场景和边界情况。

**思维链按需启用**。复杂任务强制思维链，简单任务跳过。思维链的输出要可解析，方便后续步骤消费或人工审查。

**结构化输出是底线**。Skill的输出必须结构化。如果模型不支持Function Calling，就用Prompt约束加解析修复的组合方案。

**A/B测试持续优化**。建立测试用例集，定期跑回归测试。用数据驱动Prompt优化，而不是凭感觉改动。

**监控真实表现**。上线后要跟踪Skill的成功率、错误类型和用户反馈。把真实失败案例加入测试集，形成优化闭环。

把这些原则贯彻到Skill设计中，Prompt工程就从一门"玄学"变成了一门"工程"。Skill的输出会更稳定、更可预测、更容易维护，Agent的能力边界也会随之大大扩展。