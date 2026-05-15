---
layout: ../../layouts/ArticleLayout.astro
title: "Agent日志追踪与监控系统"
lang: "zh-CN"
pubDate: 2026-03-18
updatedDate: 2026-03-18
description: "全面解析Agent系统的可观测性体系建设，涵盖日志规范、结构化日志、分布式追踪、指标采集、告警规则和可视化方案。"
author: "派"
tags: ["日志系统", "监控告警", "可观测性", "系统运维"]
draft: false
---

Agent系统的可观测性比普通应用更复杂。一个用户请求可能触发多个Agent协作，每个Agent又可能调用外部模型、工具和数据源。当问题发生时，如果没有完整的追踪能力，定位根因就像在迷宫里找出口。本文从日志规范、结构化日志、分布式追踪、指标采集、告警规则和可视化六个方面，讲解如何构建一套完整的Agent系统监控体系。

## 为什么Agent系统需要专门的可观测性方案

传统应用的可观测性主要关注系统层面的指标：CPU、内存、请求量、错误率。Agent系统除了这些，还需要关注业务层面的语义信息：模型调用次数、Token消耗、推理耗时、工具调用成功率、任务完成质量等。

Agent系统的调用链也更复杂。一个代码审查请求可能经过网关、编排引擎、代码分析Agent、安全扫描Agent、结果聚合服务，每个节点都会产生日志和指标。如果没有统一的追踪ID，串联这些分散的信息几乎不可能。

此外，Agent的任务执行时间差异巨大。简单的问答可能几百毫秒就完成，复杂的代码审查可能需要几分钟。传统基于请求响应时间的监控模型无法准确反映Agent系统的健康状态。

这些特点决定了Agent系统的可观测性方案需要同时覆盖技术层面和业务层面，既要监控基础设施，也要监控AI工作流的质量和效率。

## 日志规范与标准化

日志是可观测性的基础数据来源。没有规范的日志，再强大的分析工具也无法发挥作用。

Agent系统的日志应该包含以下标准字段。时间戳使用ISO 8601格式，包含时区信息。服务名标识产生日志的服务实例。实例ID区分同一个服务的不同副本。追踪ID用于串联分布式调用链。Span ID标识当前调用段。父Span ID标识上游调用段。日志级别使用DEBUG、INFO、WARN、ERROR、FATAL五级。消息内容使用结构化格式，便于机器解析。

```json
{
  "timestamp": "2026-03-18T14:32:10.847+08:00",
  "service": "code-review-agent",
  "instance_id": "cra-pod-7f8d9a2b-3k5m",
  "trace_id": "4f6d9c2e8a1b5f3e",
  "span_id": "a7b8c9d0e1f2",
  "parent_span_id": "1a2b3c4d5e6f",
  "level": "INFO",
  "message": "开始执行代码审查任务",
  "task_id": "cr-20260318-001",
  "repository": "acme-platform/backend",
  "commit_sha": "7a8b9c0d1e2f",
  "branch": "feature/auth-refactor",
  "language": "typescript",
  "file_count": 12,
  "lines_of_code": 2847
}
```

日志级别需要严格定义使用场景。DEBUG级别只在开发环境启用，记录详细的执行路径和变量状态。INFO级别记录正常业务流程的关键节点，比如任务开始、模型调用、结果返回。WARN级别记录潜在问题但系统仍能继续运行，比如模型响应超时但重试成功。ERROR级别记录需要处理的错误，比如模型调用失败、数据库连接断开。FATAL级别记录导致服务崩溃的严重错误。

日志采样是控制成本的重要手段。生产环境不需要记录所有DEBUG日志，可以按百分比采样。正常业务日志也可以适当采样，但错误日志应该全量保留。采样策略可以动态调整，比如平时1%采样，发现问题时临时提升到100%。

## 结构化日志实践

结构化日志使用键值对格式，比纯文本日志更适合查询和分析。所有Agent服务都应该输出结构化日志，平台提供统一的日志库来简化实现。

上下文传递是结构化日志的关键。当一个请求进入系统时，网关生成追踪ID并注入请求上下文。后续所有服务处理这个请求时，都从上下文中提取追踪ID并附加到日志中。这样即使请求经过十几个服务，所有相关日志都能通过追踪ID快速查找。

```typescript
// 结构化日志库示例
class StructuredLogger {
  private context: LogContext = {};
  
  withContext(context: Partial<LogContext>): StructuredLogger {
    const newLogger = new StructuredLogger();
    newLogger.context = { ...this.context, ...context };
    return newLogger;
  }
  
  info(message: string, fields?: Record<string, unknown>) {
    this.log('INFO', message, fields);
  }
  
  error(message: string, error?: Error, fields?: Record<string, unknown>) {
    this.log('ERROR', message, {
      ...fields,
      error_message: error?.message,
      error_stack: error?.stack,
    });
  }
  
  private log(level: string, message: string, fields?: Record<string, unknown>) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...fields,
    };
    console.log(JSON.stringify(entry));
  }
}

// 使用示例
const logger = new StructuredLogger().withContext({
  trace_id: '4f6d9c2e8a1b5f3e',
  service: 'code-review-agent',
  task_id: 'cr-20260318-001',
});

logger.info('调用代码分析模型', {
  model: 'claude-3-5-sonnet',
  prompt_tokens: 15234,
  temperature: 0.1,
});
```

业务字段是Agent系统日志的特色。除了通用字段，还应该记录业务相关的信息：模型名称和版本、Token使用量、推理耗时、工具调用参数和结果、任务类型和优先级、用户ID和租户ID。这些字段是分析Agent性能和成本的关键数据。

日志聚合使用ELK栈或类似方案。Filebeat或Fluentd从各节点收集日志，发送到Kafka做缓冲，Logstash解析和转换，Elasticsearch索引存储，Kibana可视化查询。对于大规模部署，可以考虑使用云原生的日志服务，减少运维负担。

## 分布式追踪

分布式追踪记录请求在系统中的完整路径，包括经过的服务、每个服务的处理时间、服务间的调用关系。它是排查跨服务问题的最有效工具。

追踪模型通常采用Span和Trace两级结构。Trace代表一个完整的请求链路，包含多个Span。Span代表链路中的一个操作段，包含开始时间、结束时间、操作名、标签和日志。Span之间通过父子关系或引用关系连接。

```java
// 分布式追踪实现示例
public class TracingInterceptor implements HandlerInterceptor {
    private final Tracer tracer;
    
    @Override
    public boolean preHandle(HttpServletRequest request, 
                            HttpServletResponse response, 
                            Object handler) {
        String traceId = request.getHeader("x-trace-id");
        String parentSpanId = request.getHeader("x-span-id");
        
        if (traceId == null) {
            traceId = TraceIdGenerator.generate();
        }
        
        Span span = tracer.buildSpan(request.getRequestURI())
            .withTag("http.method", request.getMethod())
            .withTag("http.url", request.getRequestURL().toString())
            .asChildOf(parentSpanId)
            .start();
        
        request.setAttribute("current_span", span);
        response.setHeader("x-trace-id", traceId);
        
        return true;
    }
    
    @Override
    public void afterCompletion(HttpServletRequest request,
                                HttpServletResponse response,
                                Object handler, Exception ex) {
        Span span = (Span) request.getAttribute("current_span");
        if (span != null) {
            span.setTag("http.status_code", response.getStatus());
            if (ex != null) {
                span.setTag("error", true);
                span.log(ImmutableMap.of(
                    "event", "error",
                    "error.kind", ex.getClass().getName(),
                    "message", ex.getMessage()
                ));
            }
            span.finish();
        }
    }
}
```

上下文传播需要在所有通信渠道中实现。HTTP请求通过Header传递追踪信息，消息队列通过消息属性传递，RPC框架通过上下文传递。如果某个中间件不支持上下文传播，就会形成追踪断点，影响问题定位。

采样策略需要精心设计。生产环境不可能记录所有请求的完整追踪，成本太高。通常使用概率采样，比如只记录1%的请求。对于错误请求、慢请求或特定用户请求，应该强制采样。还可以使用自适应采样，根据系统负载动态调整采样率。

## 指标采集与存储

指标是可观测性的量化基础。Agent系统需要采集三类指标：基础设施指标、服务指标和业务指标。

基础设施指标包括CPU使用率、内存占用、磁盘IO、网络流量、文件描述符数量等。这些指标反映系统运行环境的状态，通常由Node Exporter或类似的采集器自动收集。

服务指标包括请求量、错误率、响应时间、并发数、队列深度等。这些指标反映服务的健康状况，需要应用框架或中间件自动埋点。

```yaml
# Agent业务指标定义
agent_metrics:
  - name: agent_requests_total
    help: "Agent处理的总请求数"
    type: counter
    labels: [agent_type, status, task_priority]
  
  - name: agent_request_duration_seconds
    help: "Agent请求处理耗时"
    type: histogram
    labels: [agent_type, model_name]
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300]
  
  - name: agent_model_calls_total
    help: "模型调用次数"
    type: counter
    labels: [model_name, model_provider, status]
  
  - name: agent_model_latency_seconds
    help: "模型调用延迟"
    type: histogram
    labels: [model_name, operation]
    buckets: [0.5, 1, 2, 5, 10, 20, 30]
  
  - name: agent_token_usage_total
    help: "Token使用量"
    type: counter
    labels: [model_name, token_type]
  
  - name: agent_tasks_active
    help: "当前活跃任务数"
    type: gauge
    labels: [agent_type, priority]
  
  - name: agent_tool_calls_total
    help: "工具调用次数"
    type: counter
    labels: [tool_name, status]
```

业务指标是Agent系统特有的。模型调用次数和Token消耗量直接关系到成本，需要精确统计。推理耗时反映模型响应速度，影响用户体验。任务成功率、任务完成时间、结果质量评分这些指标反映Agent的业务价值。

指标存储使用时间序列数据库，比如Prometheus或VictoriaMetrics。时间序列数据库针对高写入、高压缩、范围查询优化，非常适合指标数据的存储和查询。对于长期存储，可以配置降采样策略，老数据保留聚合值，删除原始点。

## 告警规则设计

告警是监控体系的出口，但设计不当的告警会产生告警疲劳，让运维人员忽略真正重要的问题。

告警分级是基本实践。P0级别表示服务不可用，需要立即处理，比如所有实例宕机、数据库连接池耗尽。P1级别表示功能受损，需要在15分钟内响应，比如错误率超过5%、响应时间超过阈值。P2级别表示潜在风险，可以在1小时内处理，比如资源使用率超过80%。P3级别表示需要注意但不需要紧急处理，比如某个非核心功能异常。

```yaml
# Agent系统告警规则
alert_rules:
  - name: AgentServiceDown
    severity: P0
    condition: |
      up{job=~".*-agent"} == 0
    for: 1m
    annotations:
      summary: "Agent服务不可用"
      description: "{{ $labels.instance }} 的 {{ $labels.job }} 已宕机"
  
  - name: HighErrorRate
    severity: P1
    condition: |
      sum(rate(agent_requests_total{status="error"}[5m])) 
      / sum(rate(agent_requests_total[5m])) > 0.05
    for: 2m
    annotations:
      summary: "Agent错误率过高"
      description: "{{ $labels.agent_type }} 错误率超过5%"
  
  - name: ModelLatencyHigh
    severity: P1
    condition: |
      histogram_quantile(0.99, 
        sum(rate(agent_model_latency_seconds_bucket[5m])) by (le, model_name)
      ) > 30
    for: 3m
    annotations:
      summary: "模型响应延迟过高"
      description: "{{ $labels.model_name }} P99延迟超过30秒"
  
  - name: TokenUsageSpike
    severity: P2
    condition: |
      sum(rate(agent_token_usage_total[1h])) 
      > 1.5 * sum(rate(agent_token_usage_total[1h] offset 1d))
    for: 10m
    annotations:
      summary: "Token使用量异常增长"
      description: "Token使用量比昨日同期增长超过50%"
  
  - name: QueueBacklog
    severity: P2
    condition: |
      agent_tasks_active / agent_max_concurrent_tasks > 0.8
    for: 5m
    annotations:
      summary: "Agent任务队列积压"
      description: "{{ $labels.agent_type }} 并发度超过80%"
```

告警规则设计有几个原则。避免使用绝对阈值，尽量使用相对变化率或百分比。考虑业务周期，比如白天和晚上的基线不同，周末和工作日也不同。设置合理的持续时间，避免瞬时波动触发告警。提供足够的上下文，告警信息应该包含受影响的服务、指标值、趋势和可能的根因。

告警收敛也很重要。当多个相关服务同时告警时，应该合并为一条根因告警。比如数据库故障导致所有依赖它的Agent都告警，这时候只需要通知数据库问题，而不是让每个Agent都发一条告警。

## 可视化与故障排查

可观测性数据的最终价值在于帮助人快速理解系统状态和定位问题。可视化是连接数据和人之间的桥梁。

Dashboard设计应该分层。概览Dashboard展示系统整体健康状态，适合值班人员快速扫描。服务Dashboard展示单个服务的详细指标，适合开发人员排查问题。业务Dashboard展示业务层面的指标，比如任务完成量、用户满意度，适合产品经理关注。

```yaml
# 监控Dashboard配置示例
dashboards:
  - name: "Agent平台概览"
    refresh: "30s"
    panels:
      - title: "服务健康状态"
        type: "stat"
        targets:
          - expr: 'up{job=~".*-agent"}'
        
      - title: "请求量趋势"
        type: "graph"
        targets:
          - expr: 'sum(rate(agent_requests_total[5m])) by (agent_type)'
        
      - title: "错误率分布"
        type: "heatmap"
        targets:
          - expr: 'sum(rate(agent_requests_total{status="error"}[5m])) by (agent_type)'
        
      - title: "模型调用延迟"
        type: "graph"
        targets:
          - expr: 'histogram_quantile(0.99, sum(rate(agent_model_latency_seconds_bucket[5m])) by (le, model_name))'
        
      - title: "Token消耗量"
        type: "graph"
        targets:
          - expr: 'sum(rate(agent_token_usage_total[1h])) by (model_name, token_type)'
  
  - name: "链路追踪分析"
    panels:
      - title: "最慢Trace"
        type: "table"
        datasource: "jaeger"
        query: 'service=code-review-agent minDuration=10s'
        
      - title: "错误Trace"
        type: "table"
        datasource: "jaeger"
        query: 'service=code-review-agent tags="error=true"'
```

日志查询需要支持多维度过滤和全文检索。运维人员应该能按时间范围、服务名、日志级别、追踪ID、任务ID等条件快速过滤日志。对于错误排查，从告警直接跳转到相关日志是标准需求。

链路追踪的可视化通常采用火焰图形式。横轴表示时间，每个Span用一个矩形表示，矩形宽度表示耗时，颜色表示服务名。通过火焰图可以一眼看出请求的瓶颈在哪里，哪个服务耗时最长。

## 实际案例：某SaaS平台的可观测性改造

某SaaS平台提供AI辅助编程服务，用户通过IDE插件调用Agent进行代码补全、审查和重构。随着用户增长，系统频繁出现偶发性延迟和错误，但缺乏有效的排查手段。

改造前的主要问题如下。日志分散在各节点的本地文件，排查问题需要逐个节点登录查看。没有追踪ID，一个请求经过代码补全Agent、语法检查Agent和格式化Agent后，无法串联三者的日志。指标采集不统一，有的服务用StatsD，有的用Prometheus，有的用云监控。告警规则混乱，P0告警每天有几十条，大部分是误报。

改造方案如下。首先统一日志格式，所有服务输出JSON结构化日志，包含标准字段和业务字段。使用Fluentd收集日志到Elasticsearch，Kibana提供查询界面。

然后接入分布式追踪，使用OpenTelemetry标准。网关生成追踪ID，通过HTTP Header和消息属性传递到所有下游服务。每个Agent服务自动创建Span并记录关键操作。追踪数据存储在Jaeger，通过UI展示调用链。

指标采集使用Prometheus，为所有Agent服务定义统一的指标集。使用Grafana搭建Dashboard，按概览、服务、业务三层组织。

告警规则重新设计。取消所有基于绝对阈值的告警，改用相对变化率。引入告警收敛机制，相关告警合并为根因告警。设置告警抑制，升级期间自动暂停相关告警。

改造后，故障排查时间从平均45分钟缩短到10分钟以内。P0告警数量从每天30条降低到每周2条。一次生产环境故障中，通过追踪ID在5分钟内定位到是模型提供商的API延迟突增，快速切换到备用模型，避免了长时间的服务降级。

## 总结与最佳实践

构建Agent系统的可观测性体系，以下几点经验值得参考。

第一，日志是 foundation。没有规范的日志，其他可观测性手段都无从谈起。从项目第一天就定义日志规范，所有服务严格遵守。

第二，上下文传递要全链路。追踪ID从入口到出口不能断，否则分布式追踪就失去了意义。检查所有通信渠道是否都支持上下文传播。

第三，指标要分层。基础设施指标、服务指标、业务指标都要有，不同角色关注不同层。不要试图用一个Dashboard满足所有人。

第四，告警要克制。宁可少告警，不要多告警。每个告警规则都要经过生产验证，确保误报率低于10%。告警 fatigue 比没有告警更危险。

第五，可视化要面向场景。值班人员需要一眼看出系统是否正常，开发人员需要深入单个服务的细节，产品经理需要业务趋势。不同场景设计不同的视图。

第六，成本要控制。日志全量存储成本很高，采样策略、保留期限、存储分层都要规划好。指标的长期存储使用降采样，减少存储量。

第七，可观测性也要被监控。日志收集延迟、指标采集成功率、追踪系统可用性这些元指标需要持续监控。如果可观测性系统本身出问题，就等于失去了眼睛。

可观测性不是一次性的工程，而是持续演进的过程。随着系统复杂度增加，可观测性需求也会变化。保持数据模型的灵活性，定期回顾和优化Dashboard和告警规则，才能让可观测性体系始终发挥作用。
