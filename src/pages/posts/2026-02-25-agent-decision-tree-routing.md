---
layout: ../../layouts/ArticleLayout.astro
title: "Agent决策树与智能路由设计"
lang: "zh-CN"
pubDate: 2026-02-25
updatedDate: 2026-02-25
description: "深入探讨Agent系统中的决策树构建、智能路由算法、意图识别机制和动态调度策略，帮助开发者设计高效的Agent决策架构。"
author: "派"
tags: ["决策树", "智能路由", "意图识别", "Agent设计"]
draft: false
---

Agent在面对复杂任务时，需要做出一系列决策：用户到底想做什么？该调用哪个Skill？如果多个Skill都能处理，怎么选最优的？如果主路径失败了，怎么优雅地降级？这些问题本质上都是路由问题——把正确的请求，在正确的时间，送到正确的处理单元。

一个设计良好的决策路由系统，能让Agent像经验丰富的调度员一样，快速准确地分发任务。设计不好的系统，则会让Agent在原地打转，或者把请求发到完全不相关的Skill，用户体验一团糟。

这篇文章会从决策模型、路由算法、意图识别、分类器设计、置信度评估、Fallback策略和动态路由七个方面，系统性地讲清楚Agent决策树与智能路由的设计方法论。

## 决策模型：Agent的"大脑"如何工作

决策模型是Agent路由系统的核心。它决定了Agent如何理解用户意图、如何评估各种处理方案、如何选择最优路径。常见的决策模型有三种：规则引擎、决策树和概率模型。

规则引擎是最简单的决策模型。它用一组if-else规则来匹配输入和输出。规则引擎的优点是直观、可控、可解释性强；缺点是难以处理模糊输入，规则多了以后维护困难，而且无法从数据中学习。

```typescript
interface Rule {
  condition: (input: UserRequest) => boolean;
  action: () => Promise<AgentResponse>;
  priority: number;
}

class RuleEngine {
  private rules: Rule[] = [];

  addRule(rule: Rule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  async evaluate(input: UserRequest): Promise<AgentResponse> {
    for (const rule of this.rules) {
      if (rule.condition(input)) {
        return await rule.action();
      }
    }
    throw new Error("没有匹配的规则");
  }
}

// 使用示例
const engine = new RuleEngine();

engine.addRule({
  condition: (input) => input.intent === "查询订单",
  action: () => orderSkill.execute(),
  priority: 100
});

engine.addRule({
  condition: (input) => input.intent === "申请退款",
  action: () => refundSkill.execute(),
  priority: 90
});
```

决策树模型把决策过程组织成树形结构。每个内部节点是一个判断条件，每个叶子节点是一个处理动作。决策树比规则引擎更有结构，也更容易可视化和维护。

概率模型是目前最先进的决策方式。它用机器学习模型（如分类器、排序模型）来预测哪个处理路径最可能成功。概率模型能处理模糊输入，能从历史数据中学习，但缺点是复杂、难调试、需要训练数据。

在实际项目中，我通常采用分层决策模型。第一层用轻量级的规则或决策树做快速筛选，把明显不相关的请求过滤掉；第二层用概率模型做精细匹配，找出最优的处理路径；第三层用置信度阈值判断是否需要人工确认或Fallback。

## 意图识别：理解用户到底想做什么

意图识别是Agent路由的第一步。用户不会明确告诉Agent"请调用order_query_skill"，而是说"我的订单到哪了"或者"帮我看看我前天买的东西"。Agent需要从自然语言中抽取出意图，然后映射到内部的Skill或工具。

意图识别的方法主要有三种：关键词匹配、语义理解和多轮对话上下文。

关键词匹配是最快的方式。它维护一个意图到关键词的映射表，当用户输入包含某些关键词时，就判定为对应意图。这种方式简单高效，但容易误判。

```typescript
interface IntentMapping {
  intent: string;
  keywords: string[];
  weight: number;
}

class KeywordIntentRecognizer {
  private mappings: IntentMapping[] = [];

  addMapping(mapping: IntentMapping): void {
    this.mappings.push(mapping);
  }

  recognize(input: string): IntentResult[] {
    const results: IntentResult[] = [];
    const lowerInput = input.toLowerCase();

    for (const mapping of this.mappings) {
      let score = 0;
      for (const keyword of mapping.keywords) {
        if (lowerInput.includes(keyword.toLowerCase())) {
          score += mapping.weight;
        }
      }

      if (score > 0) {
        results.push({
          intent: mapping.intent,
          confidence: Math.min(score / (mapping.keywords.length * mapping.weight), 1.0)
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}

// 使用
const recognizer = new KeywordIntentRecognizer();
recognizer.addMapping({
  intent: "query_order",
  keywords: ["订单", "物流", "快递", "到哪了", "什么时候到"],
  weight: 1.0
});

const results = recognizer.recognize("我的快递怎么还没到");
// [{ intent: "query_order", confidence: 0.6 }]
```

语义理解是比关键词匹配更高级的方式。它用NLP模型（如BERT、Sentence-BERT）把用户输入转换成向量表示，然后和预定义的意图向量做相似度计算。这种方式能理解同义词和变体表达，准确率更高。

多轮对话上下文是指Agent在理解当前意图时，要考虑之前的对话历史。用户说"帮我退款"，Agent问"请问是哪个订单？"，用户回答"就是刚才那个"。这里的"刚才那个"就需要上下文才能理解。

```typescript
interface ConversationContext {
  history: Message[];
  currentIntent?: string;
  mentionedEntities: Map<string, Entity[]>;
}

class ContextualIntentRecognizer {
  async recognize(
    input: string,
    context: ConversationContext
  ): Promise<IntentResult> {
    // 1. 先尝试独立识别
    const standaloneResult = await this.recognizeStandalone(input);

    // 2. 如果置信度低，尝试结合上下文
    if (standaloneResult.confidence < 0.6 && context.history.length > 0) {
      return await this.recognizeWithContext(input, context);
    }

    return standaloneResult;
  }

  private async recognizeWithContext(
    input: string,
    context: ConversationContext
  ): Promise<IntentResult> {
    // 检查是否有指代消解的需求
    if (this.containsReference(input)) {
      const resolved = this.resolveReference(input, context);
      return await this.recognizeStandalone(resolved);
    }

    // 检查是否是当前意图的延续
    if (context.currentIntent && this.isContinuation(input)) {
      return {
        intent: context.currentIntent,
        confidence: 0.85,
        isContinuation: true
      };
    }

    return { intent: "unknown", confidence: 0 };
  }

  private containsReference(input: string): boolean {
    const referenceWords = ["这个", "那个", "刚才", "之前", "上一条"];
    return referenceWords.some(word => input.includes(word));
  }
}
```

## 分类器设计：把请求分到正确的类别

意图识别只告诉Agent用户想做什么的大方向，但同一个意图可能有多个Skill能处理。比如"查询天气"这个意图，可能有一个通用天气Skill，还有一个专门查询极端天气的Skill。分类器的作用就是在同一意图下，进一步细分到具体的Skill。

分类器的设计要考虑特征工程、模型选择和评估策略。

特征工程是把原始输入转换成模型能理解的特征向量。对于Agent路由，常用的特征包括：关键词命中、语义向量、用户画像、历史行为、时间上下文、设备信息等。

```typescript
interface RoutingFeatures {
  // 文本特征
  keywordMatches: Map<string, number>;
  semanticVector: number[];
  inputLength: number;
  language: string;

  // 用户特征
  userTier: "free" | "premium" | "enterprise";
  preferredSkills: string[];
  historicalAccuracy: Map<string, number>;

  // 上下文特征
  timeOfDay: number;
  dayOfWeek: number;
  deviceType: string;
  conversationTurn: number;
}

class FeatureExtractor {
  extract(request: UserRequest, context: ConversationContext): RoutingFeatures {
    return {
      keywordMatches: this.extractKeywords(request.text),
      semanticVector: this.encodeSemantic(request.text),
      inputLength: request.text.length,
      language: this.detectLanguage(request.text),
      userTier: request.user.tier,
      preferredSkills: request.user.preferences.skills,
      historicalAccuracy: this.calculateHistoricalAccuracy(request.user.id),
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      deviceType: request.device.type,
      conversationTurn: context.history.length
    };
  }

  private extractKeywords(text: string): Map<string, number> {
    const keywords = ["紧急", "立即", "帮忙", "查询", "修改", "删除", "创建"];
    const matches = new Map<string, number>();

    for (const keyword of keywords) {
      const count = (text.match(new RegExp(keyword, "g")) || []).length;
      if (count > 0) {
        matches.set(keyword, count);
      }
    }

    return matches;
  }

  private encodeSemantic(text: string): number[] {
    // 调用嵌入模型获取语义向量
    return embeddingModel.encode(text);
  }
}
```

模型选择取决于数据量和延迟要求。数据量小、延迟要求高，用逻辑回归或决策树；数据量大、准确率要求高，用神经网络或集成模型。在Agent路由场景中，延迟通常很关键，因为每次请求都要过一遍分类器。所以我倾向于用轻量级的模型，或者把复杂模型放在离线训练阶段，在线只做一个快速的查表或向量相似度计算。

评估策略不能只看准确率。在路由场景中，精确率（Precision）比召回率（Recall）更重要。把请求错发给不相关的Skill（假阳性），比漏掉一个相关Skill（假阴性）的后果更严重。因为错发会导致Skill执行失败或返回错误结果，用户体验很差；漏掉则最多是多问一句"您是指...吗"。

## 置信度评估：知道什么时候该说"我不确定"

分类器输出的是一个概率分布：Skill A有0.7的概率，Skill B有0.2的概率，Skill C有0.1的概率。这个概率就是置信度。置信度评估的关键是：设定合理的阈值，什么时候直接执行，什么时候请求确认，什么时候走Fallback。

我通常把置信度分成三个区间：

**高置信度（>0.8）**：直接执行，不需要确认。用户说"查北京明天天气"，天气Skill的置信度0.95，直接调用即可。

**中置信度（0.5-0.8）**：执行但附带确认。Agent先执行最可能的Skill，同时在回复中说"我为您查询了北京天气，如果您想问的是其他事情，请告诉我"。

**低置信度（<0.5）**：不执行，请求用户澄清。Agent回复"抱歉，我不太确定您想做什么。您是查询天气、查询订单，还是其他事情？"

```typescript
interface ConfidenceThresholds {
  high: number;
  medium: number;
  low: number;
}

interface RoutingDecision {
  action: "execute" | "execute_with_confirm" | "ask_clarification" | "fallback";
  targetSkill?: string;
  alternatives?: string[];
  confidence: number;
  reasoning: string;
}

class ConfidenceBasedRouter {
  private thresholds: ConfidenceThresholds = {
    high: 0.8,
    medium: 0.5,
    low: 0.3
  };

  async route(
    request: UserRequest,
    context: ConversationContext
  ): Promise<RoutingDecision> {
    const candidates = await this.classify(request, context);

    if (candidates.length === 0) {
      return {
        action: "fallback",
        confidence: 0,
        reasoning: "没有匹配的Skill"
      };
    }

    const topCandidate = candidates[0];

    if (topCandidate.confidence >= this.thresholds.high) {
      return {
        action: "execute",
        targetSkill: topCandidate.skill,
        confidence: topCandidate.confidence,
        reasoning: `高置信度匹配到 ${topCandidate.skill}`
      };
    }

    if (topCandidate.confidence >= this.thresholds.medium) {
      return {
        action: "execute_with_confirm",
        targetSkill: topCandidate.skill,
        alternatives: candidates.slice(1, 3).map(c => c.skill),
        confidence: topCandidate.confidence,
        reasoning: `中等置信度匹配到 ${topCandidate.skill}，提供备选`
      };
    }

    if (topCandidate.confidence >= this.thresholds.low) {
      return {
        action: "ask_clarification",
        alternatives: candidates.slice(0, 3).map(c => c.skill),
        confidence: topCandidate.confidence,
        reasoning: "置信度较低，需要用户确认"
      };
    }

    return {
      action: "fallback",
      confidence: topCandidate.confidence,
      reasoning: "置信度过低，无法判断意图"
    };
  }

  private async classify(
    request: UserRequest,
    context: ConversationContext
  ): Promise<SkillCandidate[]> {
    const features = this.featureExtractor.extract(request, context);
    return this.classifier.predict(features);
  }
}
```

置信度阈值不是固定的。不同场景可以有不同的阈值。比如金融交易类Skill的阈值应该更高，因为错误执行的成本很高；闲聊类Skill的阈值可以更低，因为即使错了也没太大关系。

置信度校准也很重要。有些模型天生"过于自信"，输出的概率分布总是集中在某一个类别上。这时候需要做校准，让置信度更真实地反映准确率。常用的校准方法有Platt Scaling和Temperature Scaling。

## Fallback策略：当所有路都走不通时

再完美的路由系统也有判断失误的时候。用户输入太模糊、新出现的概念不在训练数据中、或者是纯粹的胡言乱语，这些情况都会导致路由失败。Fallback策略就是在主路径失败时的兜底方案。

Fallback的层次设计很重要。我通常设计三层Fallback：

**第一层：Skill内Fallback**。某个Skill被选中并执行，但执行过程中发现缺少必要参数或条件不满足。这时Skill内部应该有Fallback逻辑，比如请求用户提供缺失的信息，或者使用默认值继续执行。

**第二层：路由级Fallback**。路由系统没有找到高置信度的Skill，或者所有候选Skill都拒绝执行。这时路由系统应该返回一个友好的澄清请求，或者转接到通用对话Skill。

**第三层：系统级Fallback**。即使通用对话Skill也无法处理，或者系统出现内部错误。这时应该返回一个道歉信息，并记录错误日志供后续分析。

```typescript
interface FallbackStrategy {
  canHandle(error: RoutingError): boolean;
  execute(error: RoutingError, context: ConversationContext): Promise<AgentResponse>;
}

class ClarificationFallback implements FallbackStrategy {
  canHandle(error: RoutingError): boolean {
    return error.type === "LOW_CONFIDENCE" || error.type === "AMBIGUOUS_INTENT";
  }

  async execute(
    error: RoutingError,
    context: ConversationContext
  ): Promise<AgentResponse> {
    const alternatives = error.candidates?.slice(0, 3) || [];

    if (alternatives.length > 0) {
      const skillNames = alternatives.map(c => this.getSkillDisplayName(c.skill));
      return {
        text: `抱歉，我不太确定您想做什么。您是想要${skillNames.join("、")}吗？请告诉我具体需求，我会尽力帮您。`,
        suggestedActions: alternatives.map(c => ({
          label: this.getSkillDisplayName(c.skill),
          value: c.skill
        }))
      };
    }

    return {
      text: "抱歉，我不太理解您的请求。您可以尝试用不同的方式描述，或者告诉我您想完成什么任务。"
    };
  }

  private getSkillDisplayName(skillId: string): string {
    const names: Record<string, string> = {
      "query_order": "查询订单",
      "request_refund": "申请退款",
      "check_weather": "查询天气"
    };
    return names[skillId] || skillId;
  }
}

class GeneralChatFallback implements FallbackStrategy {
  private generalChatSkill: Skill;

  canHandle(error: RoutingError): boolean {
    return error.type === "NO_MATCH" || error.type === "ALL_SKILLS_REJECTED";
  }

  async execute(
    error: RoutingError,
    context: ConversationContext
  ): Promise<AgentResponse> {
    return await this.generalChatSkill.execute({
      text: error.originalInput,
      context: context.history
    });
  }
}

class HumanHandoffFallback implements FallbackStrategy {
  canHandle(error: RoutingError): boolean {
    return error.type === "SYSTEM_ERROR" || error.retryCount > 3;
  }

  async execute(
    error: RoutingError,
    context: ConversationContext
  ): Promise<AgentResponse> {
    // 记录转人工的原因
    await this.logHandoffReason(error, context);

    return {
      text: "抱歉，我暂时无法处理您的请求。已为您转接人工客服，请稍等。",
      handoff: {
        type: "human",
        queue: "general",
        priority: error.type === "SYSTEM_ERROR" ? "high" : "normal",
        context: this.summarizeContext(context)
      }
    };
  }
}
```

Fallback策略的选择应该基于错误类型和用户价值。VIP用户的请求失败后，直接转人工可能比重试更合适；普通用户的请求失败后，先尝试澄清更经济。

## 动态路由：根据实时状态调整决策

静态路由模型在训练完成后就固定不变了，但Agent系统是在不断运行的。外部服务的状态在变、用户的偏好在变、系统的负载也在变。动态路由允许Agent根据实时状态调整路由决策。

动态路由可以基于多种信号：Skill的健康状态、响应延迟、错误率、当前负载、以及用户的实时反馈。

```typescript
interface SkillHealth {
  skillId: string;
  status: "healthy" | "degraded" | "unhealthy";
  averageLatency: number;
  errorRate: number;
  lastChecked: Date;
}

class HealthBasedRouter {
  private skillHealth = new Map<string, SkillHealth>();

  async route(request: UserRequest): Promise<RoutingDecision> {
    const candidates = await this.classify(request);

    // 过滤掉不健康的Skill
    const healthyCandidates = candidates.filter(c => {
      const health = this.skillHealth.get(c.skill);
      return !health || health.status !== "unhealthy";
    });

    // 如果有多个健康候选，按综合得分排序
    const scored = healthyCandidates.map(c => ({
      ...c,
      score: this.calculateScore(c)
    }));

    scored.sort((a, b) => b.score - a.score);

    return {
      action: "execute",
      targetSkill: scored[0]?.skill,
      confidence: scored[0]?.confidence || 0,
      reasoning: "基于健康状态和置信度的动态路由"
    };
  }

  private calculateScore(candidate: SkillCandidate): number {
    const health = this.skillHealth.get(candidate.skill);
    let healthMultiplier = 1.0;

    if (health) {
      if (health.status === "degraded") {
        healthMultiplier = 0.7;
      }
      // 延迟惩罚
      if (health.averageLatency > 1000) {
        healthMultiplier *= 0.9;
      }
      // 错误率惩罚
      if (health.errorRate > 0.05) {
        healthMultiplier *= 0.8;
      }
    }

    return candidate.confidence * healthMultiplier;
  }

  updateHealth(skillId: string, health: SkillHealth): void {
    this.skillHealth.set(skillId, health);
  }
}
```

A/B测试是动态路由的另一种形式。把流量按一定比例分配到不同版本的Skill或路由策略上，然后比较它们的效果指标（用户满意度、任务完成率、错误率等），用数据驱动决策优化。

用户反馈也是动态调整的重要依据。当用户明确纠正Agent的路由选择时（"不对，我不是要查订单，我是要退款"），系统应该记录这个反馈，用于更新分类模型或调整置信度阈值。

```typescript
interface UserFeedback {
  originalRequest: string;
  routedSkill: string;
  userCorrectedSkill?: string;
  wasHelpful: boolean;
  timestamp: Date;
}

class FeedbackLearningRouter {
  private feedbackHistory: UserFeedback[] = [];

  recordFeedback(feedback: UserFeedback): void {
    this.feedbackHistory.push(feedback);

    // 如果用户纠正了路由，立即调整权重
    if (feedback.userCorrectedSkill && feedback.userCorrectedSkill !== feedback.routedSkill) {
      this.adjustWeights(feedback);
    }
  }

  private adjustWeights(feedback: UserFeedback): void {
    // 降低错误选择的权重
    this.penalizeMisprediction(feedback.routedSkill, feedback.originalRequest);

    // 提高正确选择的权重
    this.rewardCorrectPrediction(feedback.userCorrectedSkill!, feedback.originalRequest);
  }

  private penalizeMisprediction(skillId: string, request: string): void {
    // 实现权重调整逻辑
    console.log(`降低 ${skillId} 对 "${request}" 的匹配权重`);
  }

  private rewardCorrectPrediction(skillId: string, request: string): void {
    console.log(`提高 ${skillId} 对 "${request}" 的匹配权重`);
  }

  async getImprovedModel(): Promise<ClassifierModel> {
    // 定期用反馈数据重训练模型
    return await this.retrainModel(this.feedbackHistory);
  }

  private async retrainModel(feedback: UserFeedback[]): Promise<ClassifierModel> {
    // 调用训练流程
    return await modelTrainer.train(feedback);
  }
}
```

## 实际案例：智能客服Agent的路由设计

让我们通过一个实际案例，看看上述技术如何综合运用。假设我们要为一个大型电商平台设计智能客服Agent，它需要处理订单查询、退款申请、商品咨询、投诉建议、技术支持等多种请求。

首先，设计多层级决策架构：

第一层是意图识别。用户输入"我要退款"，意图识别模块判断这是"售后"意图，置信度0.92。用户输入"这件衣服有蓝色的吗"，意图识别判断是"商品咨询"，置信度0.78。

第二层是Skill选择。在"售后"意图下，有两个Skill能处理："退款申请"和"换货申请"。分类器分析用户输入中的关键词"退款"，给"退款申请"Skill打0.88分，给"换货申请"Skill打0.15分。

第三层是置信度评估。0.88分属于高置信度，直接执行"退款申请"Skill，不需要用户确认。

现在考虑一个复杂场景：用户输入"我上次买的东西有问题"。意图识别判断"售后"意图，置信度0.65（因为"上次买的东西"比较模糊）。分类器在售后Skill中选择：退款申请0.4分、换货申请0.35分、投诉建议0.2分。最高才0.4分，属于低置信度。

路由系统决定不走主路径，而是执行Fallback："抱歉，为了帮您更好地解决问题，请问您是需要退款、换货，还是其他售后服务？"用户回答"我要退款"，这时上下文结合后，退款申请的置信度提升到0.9，直接执行。

动态路由在这里也发挥作用。假设退款申请Skill依赖的支付系统正在维护，健康监控检测到退款Skill状态为"degraded"。这时来了一个退款请求，虽然退款Skill的原始置信度最高，但健康状态降低了它的得分。如果还有一个"问题记录"Skill可以暂时记录用户的问题（状态为healthy），路由系统可能会选择"问题记录"Skill，并告诉用户"支付系统正在维护，我已记录您的问题，维护完成后会立即处理"。

```typescript
// 电商客服Agent路由配置
const customerServiceRouter = new DynamicRouter({
  intentRecognizer: new HybridIntentRecognizer({
    keywordRecognizer: new KeywordIntentRecognizer(),
    semanticRecognizer: new SemanticIntentRecognizer(bertModel),
    contextRecognizer: new ContextualIntentRecognizer()
  }),

  classifier: new EnsembleClassifier([
    new LogisticRegressionClassifier(features),
    new SemanticSimilarityClassifier(embeddingModel)
  ]),

  confidenceThresholds: {
    high: 0.85,
    medium: 0.6,
    low: 0.4
  },

  fallbackChain: [
    new SkillInternalFallback(),
    new ClarificationFallback(),
    new GeneralChatFallback(),
    new HumanHandoffFallback()
  ],

  healthMonitor: new SkillHealthMonitor({
    checkInterval: 30000,
    latencyThreshold: 2000,
    errorRateThreshold: 0.1
  }),

  feedbackLoop: new FeedbackLearningRouter()
});
```

## 总结与最佳实践

Agent决策树与智能路由的设计，本质上是让Agent学会"看情况办事"。以下是一些关键的最佳实践：

**分层决策，逐层过滤**。不要试图用一个模型解决所有问题。先用轻量级模型做快速筛选，再用精细模型做深度匹配，最后用置信度做质量把关。每一层只处理下一层交给它的问题。

**置信度阈值要可调**。不同Skill、不同用户、不同场景，应该有不同阈值。VIP用户的请求可以更谨慎，普通用户的请求可以更激进。金融类Skill的阈值要比闲聊类Skill高。

**Fallback不是失败，是用户体验的一部分**。好的Fallback能让用户感觉Agent在努力理解，而不是简单粗暴地说"我不懂"。提供选项、请求澄清、转人工，都是合理的Fallback策略。

**健康监控决定动态路由**。定期检查Skill的响应时间、错误率、资源使用情况。当某个Skill不健康时，降低它的路由优先级，或者完全跳过它。避免把请求发给已经故障的Skill。

**从反馈中学习**。每次用户纠正Agent的路由选择，都是宝贵的训练数据。建立反馈闭环，定期用真实用户数据优化分类模型。但不要在线实时更新模型，要经过测试后再部署。

**可观测性是一切的基础**。路由系统的每个决策都应该被记录：输入是什么、匹配到了哪些候选、各自的置信度是多少、最终选择了哪个、执行结果如何。这些数据是优化路由策略的唯一依据。

**A/B测试验证改进**。不要凭感觉调整路由策略。把改进版本和当前版本并行运行，用指标说话。关注任务完成率、用户满意度、平均交互轮数等核心指标。

**保持简单，直到有必要复杂化**。不要一开始就上神经网络。先用规则或决策树验证核心逻辑，等业务场景稳定后再逐步引入机器学习。复杂模型带来的维护成本可能超过准确率提升带来的收益。

把这些原则应用到Agent路由系统的设计中，Agent就能像经验丰富的调度员一样，快速、准确、优雅地把每个请求送到最合适的处理单元。路由系统不再是Agent的瓶颈，而是它的智能放大器。
