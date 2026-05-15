---
layout: ../../layouts/ArticleLayout.astro
title: "领域特定Skill构建：垂直场景实践"
lang: "zh-CN"
pubDate: 2026-01-21
updatedDate: 2026-01-21
description: "深入探讨如何构建面向垂直领域的专业Skill，涵盖领域建模、知识图谱、专业术语、业务规则、场景适配和实际案例分析。"
author: "派"
tags: ["领域驱动", "垂直应用", "Skill定制", "业务场景"]
draft: false
---

通用Agent能处理各种开放任务，但在垂直领域里往往力不从心。医疗诊断需要理解医学术语和临床指南，法律咨询需要掌握法条和判例，金融分析需要熟悉财报结构和市场指标。这些专业知识不是简单加一段提示词就能获得的，需要系统性的领域建模和Skill设计。这篇文章讲清楚如何构建真正有用的领域特定Skill。

## 为什么通用Agent在垂直领域表现不佳

通用LLM在垂直领域的问题不是知识不够，而是知识太泛。它知道很多概念，但不清楚这些概念在特定领域里的精确含义、适用边界和相互关系。

以医疗领域为例。通用模型知道"高血压"是一种疾病，但它可能不清楚不同指南对高血压分级的细微差别，不知道某种降压药在特定并发症患者身上的禁忌，也无法准确理解检验报告中的各项指标含义和参考范围。这些细节对非专业人士是"过于专业"，对专业人士却是"基本常识"。

另一个问题是术语歧义。同一个词在不同领域有不同含义。"接口"在软件领域是API，在机械领域是连接件，在医学领域是皮肤创面。通用模型根据上下文能猜对大部分情况，但在专业场景中，猜错的代价很高。

还有业务规则的复杂性。垂直领域的操作往往不是"知道知识"就够的，还需要遵循特定的流程和规范。比如药物处方要遵循"诊断 -> 评估禁忌 -> 选择药物 -> 确定剂量 -> 监测指标"的流程，跳过任何一步都可能导致严重后果。这些规则是结构化的、强制性的，不能靠模型的"常识"来推断。

所以领域特定Skill的核心任务，就是把领域知识、术语体系和业务规则编码成Agent可以稳定执行的结构。

## 领域建模：从知识到结构

领域建模是构建专业Skill的第一步。目标是把领域专家头脑中的隐性知识，变成显性的、可计算的结构。

领域建模通常从概念模型开始。识别领域中的核心实体、属性和关系。以法律领域为例，核心实体包括案件、法条、当事人、法院、律师等。关系包括"案件适用法条""当事人委托律师""法院判决案件"等。

```yaml
# 法律领域概念模型示例
domain: legal
entities:
  Case:
    attributes:
      - caseNumber: string
      - caseType: enum [civil, criminal, administrative]
      - filingDate: date
      - status: enum [filed, hearing, pending, closed]
    
  Statute:
    attributes:
      - code: string
      - article: string
      - text: string
      - effectiveDate: date
      - category: string
    
  Party:
    attributes:
      - name: string
      - role: enum [plaintiff, defendant, third_party]
      - entityType: enum [individual, corporate]

relations:
  - name: applies_to
    from: Statute
    to: Case
    attributes:
      - relevanceScore: float
      - interpretation: string
  
  - name: involved_in
    from: Party
    to: Case
    attributes:
      - role: string
      - claims: string[]
```

概念模型之后是流程模型。识别领域中的典型工作流程，把每个流程拆成步骤、决策点和分支条件。流程模型比概念模型更动态，它描述的是"什么时候做什么"。

```yaml
# 法律案件分析流程
process: case-analysis
steps:
  - id: extract-facts
    name: 提取案件事实
    input: [caseDescription, evidenceList]
    output: [factTimeline, disputedFacts]
  
  - id: identify-issues
    name: 识别争议焦点
    input: [factTimeline, disputedFacts]
    output: [legalIssues, factualIssues]
    
  - id: search-statutes
    name: 检索适用法条
    input: [legalIssues]
    output: [applicableStatutes, relevantPrecedents]
    
  - id: analyze-arguments
    name: 分析双方论点
    input: [factualIssues, applicableStatutes]
    output: [plaintiffArguments, defendantArguments]
    
  - id: evaluate-strength
    name: 评估胜诉概率
    input: [plaintiffArguments, defendantArguments, relevantPrecedents]
    output: [strengthAssessment, riskFactors]
    
  - id: generate-recommendation
    name: 生成策略建议
    input: [strengthAssessment, riskFactors]
    output: [recommendedStrategy, alternativeOptions]
```

最后是规则模型。把领域中的约束、计算逻辑和判断标准编码成规则。规则模型通常是声明式的，便于维护和验证。

```typescript
// 医疗领域规则示例
interface MedicalRule {
  id: string;
  condition: (patient: PatientData, context: ClinicalContext) => boolean;
  action: (patient: PatientData) => Recommendation[];
  priority: number;
  source: string; // 规则来源，如临床指南
}

const hypertensionRules: MedicalRule[] = [
  {
    id: 'htn-001',
    condition: (p, ctx) => 
      p.systolicBP >= 140 || p.diastolicBP >= 90,
    action: (p) => [{
      type: 'lifestyle',
      details: '建议低盐饮食、规律运动、控制体重'
    }],
    priority: 1,
    source: '2023中国高血压防治指南'
  },
  {
    id: 'htn-002',
    condition: (p, ctx) =>
      (p.systolicBP >= 160 || p.diastolicBP >= 100) &&
      !p.hasContraindication('ACEI'),
    action: (p) => [{
      type: 'medication',
      drug: 'ACEI',
      details: '首选ACEI类降压药'
    }],
    priority: 2,
    source: '2023中国高血压防治指南'
  }
];
```

## 知识图谱：连接离散的知识

概念模型、流程模型和规则模型解决了"有什么"的问题，但知识之间的关联还需要知识图谱来承载。

知识图谱用图结构表示实体和关系，适合表达复杂的领域关联。在医学领域，疾病、症状、药物、检查、科室之间构成了庞大的知识网络。当Agent遇到一个症状时，可以通过图谱推理可能的疾病，再进一步查询相关的检查项目和用药建议。

```cypher
// 医学知识图谱示例（Cypher查询语言）
// 创建实体
CREATE (d:Disease {name: '2型糖尿病', code: 'E11'})
CREATE (s:Symptom {name: '多饮', type: 'classic'})
CREATE (s2:Symptom {name: '多尿', type: 'classic'})
CREATE (drug:Drug {name: '二甲双胍', category: '口服降糖药'})
CREATE (check:Examination {name: '空腹血糖', unit: 'mmol/L'})

// 创建关系
CREATE (d)-[:HAS_SYMPTOM {frequency: 'common'}]->(s)
CREATE (d)-[:HAS_SYMPTOM {frequency: 'common'}]->(s2)
CREATE (d)-[:FIRST_LINE_TREATMENT]->(drug)
CREATE (d)-[:DIAGNOSTIC_CRITERIA {threshold: '>=7.0'}]->(check)
CREATE (drug)-[:CONTRAINDICATED {condition: '严重肾功能不全'}]->(d)
```

知识图谱的查询和推理是Agent调用专业知识的入口。当用户描述症状时，Agent先在图谱中匹配相关实体，然后通过关系遍历找到关联的诊断、治疗和检查建议。

```python
# 基于知识图谱的推理
class MedicalReasoner:
    def __init__(self, graph):
        self.graph = graph
    
    async def differential_diagnosis(self, symptoms: list[str]) -> list[Diagnosis]:
        # 根据症状查找可能的疾病
        query = """
        MATCH (d:Disease)-[r:HAS_SYMPTOM]->(s:Symptom)
        WHERE s.name IN $symptoms
        RETURN d.name as disease, 
               count(r) as matching_symptoms,
               collect(r.frequency) as frequencies
        ORDER BY matching_symptoms DESC
        """
        
        results = await self.graph.run(query, symptoms=symptoms)
        
        diagnoses = []
        for record in results:
            disease = record['disease']
            # 查询该疾病的其他症状用于鉴别
            other_symptoms = await self.get_other_symptoms(disease, symptoms)
            
            diagnoses.append(Diagnosis(
                disease=disease,
                confidence=self.calculate_confidence(record),
                matchingSymptoms=record['matching_symptoms'],
                missingSymptoms=other_symptoms,
                suggestedExams=await self.get_diagnostic_exams(disease)
            ))
        
        return diagnoses
```

知识图谱的构建不是一次性的。初始可以用公开的知识库如UMLS、Wikidata医学子集，但垂直领域的很多知识是业务特有的，需要持续从实际案例中提取和补充。建议建立知识更新机制，定期把Agent处理过的新案例中的知识提取出来，经过人工审核后加入图谱。

## 专业术语处理：消除歧义

术语是专业领域的基础。通用模型对术语的理解往往是"知道大概意思"，而不是"知道精确含义和上下文限制"。

术语词典是最基础的组件。收集领域内的专业术语，给出标准定义、同义词、反义词、相关概念和使用场景。

```yaml
# 金融术语词典示例
terms:
  - term: "市盈率"
    abbreviation: "P/E"
    definition: "股票价格与每股收益的比率，衡量股票估值水平"
    synonyms: ["PE ratio", "price-earnings ratio"]
    formula: "P/E = 股价 / 每股收益"
    context: "估值分析"
    interpretation:
      high: "可能高估，或预期高增长"
      low: "可能低估，或增长前景不佳"
      compare: "同行业对比更有意义"
  
  - term: "净资产收益率"
    abbreviation: "ROE"
    definition: "净利润与股东权益的比率，衡量股东投资回报"
    formula: "ROE = 净利润 / 平均股东权益"
    context: "盈利能力分析"
    related: ["ROA", "杜邦分析"]
```

术语消歧在Agent处理用户输入时很重要。同一个词在不同语境下含义不同，Agent需要能根据上下文选择正确的释义。

```python
# 术语消歧示例
class TermDisambiguator:
    def __init__(self, term_dict):
        self.terms = term_dict
    
    def disambiguate(self, term: str, context: str) -> TermDefinition:
        candidates = self.terms.get(term, [])
        if len(candidates) <= 1:
            return candidates[0] if candidates else None
        
        # 用上下文计算每个候选的相关度
        scores = []
        for candidate in candidates:
            score = self.context_similarity(context, candidate)
            scores.append((candidate, score))
        
        # 返回最相关的释义
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[0][0]
    
    def context_similarity(self, context: str, candidate: TermDefinition) -> float:
        # 基于领域上下文、相关术语和使用场景计算相似度
        similarity = 0
        
        # 上下文包含候选的领域标签
        if candidate.domain in context:
            similarity += 0.4
        
        # 上下文包含相关术语
        for related in candidate.related_terms:
            if related in context:
                similarity += 0.2
        
        # 使用语义相似度模型
        similarity += self.semantic_similarity(context, candidate.definition)
        
        return similarity
```

术语标准化也很重要。用户在输入时可能使用口语化表达、缩写或错别字，Agent需要能映射到标准术语。比如用户说"血压高"应该映射到"高血压"，说"血糖有点高"应该映射到"高血糖"或进一步确认是空腹血糖还是餐后血糖。

## 业务规则引擎：把规范变成可执行逻辑

垂直领域的很多操作受制于规范、标准和法规。这些规则不能靠模型的"理解"来执行，需要显式的规则引擎。

规则引擎的核心是把业务规则从代码中分离出来，用声明式的方式定义，由引擎解释执行。这样规则可以独立维护和更新，不需要改代码。

```typescript
// 规则引擎核心
interface RuleEngine {
  evaluate(facts: FactBag): RuleResult[];
}

class DroolsLikeEngine implements RuleEngine {
  private rules: Rule[] = [];
  
  addRule(rule: Rule) {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }
  
  evaluate(facts: FactBag): RuleResult[] {
    const results: RuleResult[] = [];
    const workingMemory = new WorkingMemory(facts);
    
    for (const rule of this.rules) {
      if (rule.when(workingMemory)) {
        const result = rule.then(workingMemory);
        results.push(result);
        
        // 如果规则标记为独占，停止后续规则
        if (rule.salience === 'exclusive') break;
      }
    }
    
    return results;
  }
}

// 金融合规规则示例
const amlRules: Rule[] = [
  {
    name: '大额交易报告',
    priority: 100,
    when: (wm) => {
      const tx = wm.get('transaction');
      return tx.amount > 50000 && tx.type === 'cash';
    },
    then: (wm) => ({
      action: 'report',
      target: 'regulatory_authority',
      deadline: '24h'
    })
  },
  {
    name: '可疑交易监控',
    priority: 90,
    when: (wm) => {
      const tx = wm.get('transaction');
      const history = wm.get('transaction_history');
      return tx.amount > history.dailyAverage * 10;
    },
    then: (wm) => ({
      action: 'flag',
      reason: 'unusual_amount',
      requiresReview: true
    })
  }
];
```

规则的可解释性在垂直领域很重要。当Agent做出一个决策时，用户需要知道是基于什么规则。规则引擎应该能输出触发的规则列表和匹配的事实，形成完整的推理链。

```python
# 规则执行的可解释性
class ExplainableRuleEngine:
    def evaluate_with_explanation(self, facts):
        trace = ExecutionTrace()
        
        for rule in self.rules:
            match_result = rule.evaluate(facts)
            
            trace.add_step(
                rule_name=rule.name,
                condition=rule.condition_text,
                matched=match_result.matched,
                bindings=match_result.bindings,
                action=match_result.action if match_result.matched else None
            )
            
            if match_result.matched:
                facts = self.apply_action(facts, match_result.action)
        
        return {
            'result': facts,
            'trace': trace,
            'explanation': self.generate_explanation(trace)
        }
    
    def generate_explanation(self, trace):
        triggered = [s for s in trace.steps if s.matched]
        
        explanation = f"决策基于 {len(triggered)} 条规则：\n"
        for step in triggered:
            explanation += f"- {step.rule_name}：{step.condition}\n"
            explanation += f"  匹配事实：{step.bindings}\n"
            explanation += f"  执行动作：{step.action}\n"
        
        return explanation
```

## 场景适配：不同情境下的差异化处理

同一个领域，不同场景下的处理逻辑可能截然不同。以医疗领域为例，急诊和门诊的诊疗流程、优先级判断和风险容忍度都不一样。

场景适配需要在Skill层面做差异化设计。可以定义场景模板，每个模板包含特定的规则集、知识库子集、处理流程和输出格式。

```yaml
# 医疗场景模板
scenarios:
  emergency:
    name: 急诊
    priority: critical
    rules: [triage-rules, emergency-protocols]
    knowledge_base: emergency_medicine
    workflow: rapid_assessment
    time_constraints:
      initial_assessment: "5min"
      treatment_decision: "15min"
    
  outpatient:
    name: 门诊
    priority: normal
    rules: [standard-diagnosis-rules, prescription-guidelines]
    knowledge_base: general_medicine
    workflow: standard_consultation
    time_constraints:
      consultation: "30min"
      
  follow_up:
    name: 复诊
    priority: normal
    rules: [follow-up-rules, medication-adjustment]
    knowledge_base: patient_history
    workflow: follow_up_visit
    requires_context: [previous_visit, current_meds, lab_results]
```

场景识别是适配的第一步。Agent需要根据用户输入的上下文判断当前处于什么场景。可以用分类模型，也可以基于规则的关键词匹配和上下文推断。

```python
# 场景识别
class ScenarioDetector:
    def __init__(self):
        self.scenarios = {
            'emergency': EmergencyScenario(),
            'outpatient': OutpatientScenario(),
            'follow_up': FollowUpScenario()
        }
    
    def detect(self, user_input: str, context: dict) -> Scenario:
        # 基于关键词的初步判断
        emergency_keywords = ['急诊', '急救', '突然', '剧痛', '昏迷', '出血']
        if any(kw in user_input for kw in emergency_keywords):
            return self.scenarios['emergency']
        
        # 基于上下文的推断
        if context.get('visit_type') == 'follow_up':
            return self.scenarios['follow_up']
        
        # 默认场景
        return self.scenarios['outpatient']
```

## 案例分析：金融报告分析Skill

我们为一个投资机构构建了一个财报分析Skill，用于自动分析上市公司的季度和年度财报。

这个Skill的核心挑战在于财报数据的结构复杂性和分析逻辑的专业性。一份年报可能包含数百页内容，涉及资产负债表、利润表、现金流量表、附注和管理层讨论等多个部分。分析时需要跨表勾稽、同比环比、行业对比和异常检测。

领域建模阶段，我们定义了财报的核心实体：Report（报告）、FinancialStatement（报表）、AccountItem（科目）、Indicator（指标）。关系包括"报告包含报表""报表由科目组成""指标基于科目计算"。

```typescript
// 财报数据结构
interface FinancialReport {
  company: Company;
  period: ReportingPeriod;
  statements: FinancialStatement[];
}

interface FinancialStatement {
  type: 'balance_sheet' | 'income_statement' | 'cash_flow';
  items: AccountItem[];
}

interface AccountItem {
  code: string;
  name: string;
  amount: number;
  parentCode?: string;
  notes?: string;
}

// 指标计算规则
interface IndicatorRule {
  name: string;
  formula: (items: AccountItem[]) => number;
  unit: string;
  interpretation: IndicatorInterpretation;
}

const indicators: IndicatorRule[] = [
  {
    name: '流动比率',
    formula: (items) => {
      const currentAssets = sumByCode(items, '1xxx'); // 流动资产
      const currentLiabilities = sumByCode(items, '2xxx'); // 流动负债
      return currentAssets / currentLiabilities;
    },
    unit: '倍',
    interpretation: {
      normal: { min: 1.5, max: 2.5 },
      tooHigh: '资金利用效率可能偏低',
      tooLow: '短期偿债能力可能不足'
    }
  }
];
```

知识图谱用于存储行业基准和历史数据。当分析一家公司的毛利率时，Skill会查询图谱中同行业其他公司的毛利率分布，判断这家公司的水平是偏高、正常还是偏低。

业务规则引擎处理异常检测。比如"应收账款增长率超过收入增长率50%""存货周转天数同比恶化超过30%""经营现金流连续两个季度为负"等规则，触发后Skill会在分析报告中标注风险点。

```python
# 财报异常检测规则
class FinancialAnomalyDetector:
    def __init__(self, rules, historical_data):
        self.rules = rules
        self.history = historical_data
    
    def detect(self, report: FinancialReport) -> list[Anomaly]:
        anomalies = []
        
        for rule in self.rules:
            if rule.check(report, self.history):
                anomalies.append(Anomaly(
                    rule=rule.name,
                    severity=rule.severity,
                    description=rule.describe(report),
                    related_items=rule.get_related_items(report)
                ))
        
        return anomalies

# 具体规则实现
anomaly_rules = [
    RevenueReceivableMismatchRule(),
    InventoryTurnoverDeteriorationRule(),
    CashFlowWarningRule(),
    RelatedPartyTransactionRule()
]
```

场景适配方面，这个Skill支持三种分析模式：快速概览（5分钟生成核心指标和风险提示）、标准分析（30分钟生成完整报告）、深度研究（2小时生成包含行业对比和估值分析的详细报告）。用户根据时间需求选择模式，Skill自动调整分析的粒度和范围。

上线后，这个Skill把分析师处理单份财报的时间从4小时降到了45分钟（标准模式），而且覆盖了更多人工容易遗漏的勾稽关系和异常指标。

## 最佳实践：构建可靠的领域Skill

构建领域特定Skill是一个系统工程，以下是一些经过验证的实践建议。

在领域建模上，不要试图一次性建完美模型。先覆盖核心场景，再逐步扩展。和领域专家紧密合作，用他们熟悉的语言和概念，而不是强行套用技术术语。

在知识管理上，区分稳定知识和动态知识。会计准则、医学指南这类稳定知识可以硬编码在规则里，市场价格、最新判例这类动态知识需要通过外部接口实时获取。

在术语处理上，建立双向映射。不仅要把用户输入映射到标准术语，也要在输出时把标准术语解释给用户。避免"只说行话"，也避免"过度简化"。

在规则设计上，优先用声明式规则而非过程式代码。规则更容易被领域专家理解和审核，也更容易维护和更新。但要确保规则引擎的性能，规则数量大时可能需要索引和预编译。

在场景适配上，明确定义场景的触发条件和边界。场景之间不应该有重叠的灰色地带，否则Agent会在多个场景间摇摆。每个场景的处理流程要完整，不能假设其他场景已经做了某些处理。

在质量保障上，建立领域特定的评估标准。通用评估指标如BLEU、ROUGE在垂直领域往往不够，需要设计任务特定的评估方法。比如医疗Skill要评估诊断准确率，法律Skill要评估法条引用正确率，金融Skill要评估计算准确性。

最后，领域Skill需要持续迭代。领域知识在更新，业务规则在变化，用户需求在演进。建立反馈闭环，收集实际使用中的错误案例和改进建议，定期更新模型和规则。一个停滞不前的领域Skill，很快就会变得不可靠。