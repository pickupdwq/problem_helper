---
layout: ../../layouts/ArticleLayout.astro
title: "OpenCode Skill 系统解析：定制你的专属 AI 助手"
lang: "zh-CN"
pubDate: "2026-03-21"
updatedDate: "2026-03-21"
description: "深入解析 OpenCode 的 Skill 系统设计原理，分享创建高效 Skill 的方法论，以及个人 Skill 库的建设经验。"
author: "AI 工具观察员"
tags: ["OpenCode", "Skill", "AI 定制", "开发效率", "工具配置"]
draft: false
---

如果说 Agent 是 OpenCode 的手，那么 Skill 就是它的大脑。Skill 系统让 OpenCode 从"通用的 AI 助手"变成了"懂你的专业伙伴"。

用了半年 OpenCode，我创建了 30+ 个 Skill，覆盖了我工作中 80% 的重复性任务。这篇文章分享 Skill 系统的设计原理和实战技巧。

## 本文要点

- Skill 的本质是"结构化提示词 + 上下文注入 + 工具调用规则"
- 好的 Skill 应该聚焦单一任务，边界清晰，输入输出明确
- Skill 的积累是一个渐进过程，从高频需求开始，逐步覆盖工作流
- 分享和交流 Skill 是提升团队效率的有效方式

## Skill 的本质：超越提示词工程

很多人把 Skill 理解为"保存的提示词模板"，这个理解太浅了。

一个完整的 Skill 包含四个层面：

### 1. 意图识别层

定义 Skill 的触发条件。OpenCode 使用语义匹配而非关键词匹配：

```yaml
trigger:
  description: "当用户需要生成 React 组件时触发"
  examples:
    - "帮我写一个按钮组件"
    - "创建一个带加载状态的用户卡片"
    - "实现一个可排序的表格"
  negative_examples:
    - "React 是什么"  # 这是知识问答，不是组件生成
    - "怎么配置 webpack"  # 这是配置问题
```

好的触发定义能大幅减少误触发，提升使用体验。

### 2. 上下文注入层

自动注入相关的项目上下文：

```yaml
context:
  files:
    - "src/components/common/*.tsx"  # 通用组件参考
    - "src/styles/theme.ts"  # 主题配置
  variables:
    framework: "React 18 + TypeScript"
    styling: "Tailwind CSS + CSS Modules"
    testing: "Jest + React Testing Library"
```

这意味着每次使用这个 Skill，Agent 都会自动了解你的技术栈和现有组件风格。

### 3. 提示词模板层

这是 Skill 的核心，但不是全部：

```yaml
template: |
  请生成一个 React 组件，要求：
  
  需求：{user_input}
  
  技术规范：
  1. 使用函数组件 + Hooks
  2. 包含 TypeScript 类型定义
  3. 样式使用 Tailwind CSS
  4. 支持 forwardRef
  5. 包含 JSDoc 注释
  6. 导出默认组件 + 命名导出类型
  
  输出格式：
  - 先给出组件设计思路（2-3 句话）
  - 然后给出完整代码
  - 最后列出 Props 说明表格
```

### 4. 后处理层

对 AI 输出进行格式化和验证：

```yaml
post_process:
  - type: lint
    command: "eslint --fix"
  - type: format
    command: "prettier --write"
  - type: validate
    rule: "必须包含 export default"
```

## Skill 创建的五个原则

### 原则 1：单一职责

一个 Skill 只做一件事。不要创建"全能开发助手"，而是创建"React 组件生成器"、"API 错误处理中间件生成器"、"数据库迁移脚本生成器"。

**反例**：
```yaml
# 糟糕的 Skill：职责过于宽泛
name: "全栈开发助手"
description: "帮你做前端、后端、数据库的所有事情"
```

**正例**：
```yaml
# 好的 Skill：聚焦单一任务
name: "Express API Endpoint Generator"
description: "生成符合 RESTful 规范的 Express 路由、控制器和测试"
```

### 原则 2：边界清晰

明确定义 Skill 的输入和输出：

```yaml
input:
  - name: "entity_name"
    type: "string"
    description: "实体名称，如 User、Product"
    required: true
  - name: "fields"
    type: "array"
    description: "字段列表，每个字段包含 name、type、required"
    required: true
  - name: "auth_required"
    type: "boolean"
    description: "是否需要认证"
    default: true

output:
  - "路由文件 (routes/{entity}.js)"
  - "控制器文件 (controllers/{entity}.js)"
  - "模型文件 (models/{entity}.js)"
  - "测试文件 (tests/{entity}.test.js)"
  - "API 文档片段"
```

### 原则 3：渐进式复杂度

Skill 应该支持从简单到复杂的渐进使用：

**第一层：最小输入**
```
用户：生成用户 API
Skill：使用默认配置生成完整的 CRUD API
```

**第二层：部分定制**
```
用户：生成用户 API，只需要登录和注册
Skill：只生成认证相关接口
```

**第三层：完全定制**
```
用户：生成用户 API，字段包括 email、phone、avatar，需要邮箱验证，支持 OAuth
Skill：生成包含所有特定需求的实现
```

### 原则 4：可验证性

Skill 的输出应该可以被自动验证：

```yaml
validation:
  - type: "syntax"
    description: "代码必须能通过 TypeScript 编译"
    command: "tsc --noEmit {output_file}"
  - type: "test"
    description: "生成的测试必须能通过"
    command: "jest {test_file}"
  - type: "lint"
    description: "代码必须符合项目规范"
    command: "eslint {output_file}"
```

### 原则 5：持续迭代

Skill 不是一次性创建的。我维护的每个 Skill 平均经历了 5-8 次迭代：

```yaml
# Skill 元数据中的版本记录
version: "2.3.1"
changelog:
  - version: "2.3.1"
    date: "2026-03-15"
    changes:
      - "修复了可选字段的 TypeScript 类型定义问题"
  - version: "2.3.0"
    date: "2026-03-01"
    changes:
      - "新增支持文件上传字段"
      - "优化了错误响应格式"
```

## 我的个人 Skill 库分享

以下是我每天都在使用的 Skill，按使用频率排序：

### Tier 1：高频使用（每天多次）

**1. React Component Generator**
- 使用频率：~10 次/天
- 价值：统一了团队组件风格，新成员上手时间从 1 周缩短到 1 天
- 关键设计：自动读取项目现有的组件库，保持风格一致

**2. API Endpoint Generator**
- 使用频率：~5 次/天
- 价值：API 开发时间从 30 分钟缩短到 5 分钟
- 关键设计：自动生成 Swagger 文档片段和测试用例

**3. Commit Message Writer**
- 使用频率：~8 次/天
- 价值：提交信息规范率从 60% 提升到 98%
- 关键设计：分析 diff 内容，自动推断 type 和 scope

### Tier 2：中频使用（每周多次）

**4. Code Review Assistant**
- 使用频率：~3 次/天
- 价值：发现了约 30% 的人工审查遗漏的问题
- 关键设计：分维度检查（安全、性能、可读性、测试）

**5. Test Case Generator**
- 使用频率：~2 次/天
- 价值：测试编写时间减少 70%
- 关键设计：自动识别边界条件和错误路径

**6. Documentation Writer**
- 使用频率：~1 次/天
- 价值：文档与代码同步率大幅提升
- 关键设计：从代码注释和类型定义生成文档

### Tier 3：低频使用（每月几次）

**7. Database Migration Generator**
- 使用频率：~2 次/月
- 价值：避免手写迁移脚本的语法错误
- 关键设计：分析模型变更，生成安全的迁移脚本

**8. Dependency Update Assistant**
- 使用频率：~1 次/月
- 价值：自动检查 breaking changes，生成升级指南
- 关键设计：读取 changelog，总结对用户的影响

**9. Performance Audit**
- 使用频率：~1 次/月
- 价值：系统性地发现性能瓶颈
- 关键设计：分析代码模式，识别常见的性能反模式

**10. Security Scanner**
- 使用频率：~1 次/月
- 价值：补充了静态安全扫描工具的不足
- 关键设计：识别业务逻辑层面的安全问题（如权限绕过）

## Skill 创建实战：从零到一

让我演示创建一个实用 Skill 的完整过程。

**需求**：团队经常需要创建新的 API 端点，但每个开发者写出来的代码风格不一致，文档也不完整。

**Step 1：分析需求**

观察团队现有的 API 代码，找出共同模式：
- 使用 Express + TypeScript
- 统一的错误响应格式
- JWT 认证中间件
- 输入验证使用 Zod
- 自动 Swagger 文档
- Jest 测试

**Step 2：设计 Skill 结构**

```yaml
name: "Express API Generator"
description: "生成符合团队规范的 Express API 端点"
version: "1.0.0"

trigger:
  description: "当需要创建新的 API 端点时"
  keywords: ["api", "endpoint", "route", "controller"]

context:
  files:
    - "src/middleware/errorHandler.ts"
    - "src/middleware/auth.ts"
    - "src/utils/response.ts"
  variables:
    framework: "Express.js"
    language: "TypeScript"
    validation: "Zod"
    auth: "JWT"

template: |
  请为以下需求生成完整的 API 实现：
  
  需求：{user_input}
  
  必须包含：
  1. TypeScript 接口定义（请求体、响应体、路径参数）
  2. Zod 验证 Schema
  3. Express 路由定义
  4. 控制器函数（包含错误处理）
  5. Jest 单元测试（成功路径 + 错误路径）
  6. Swagger 文档注释
  
  规范：
  - 使用 async/await，不使用回调
  - 错误处理统一使用 next(error)
  - 响应格式：{ success: boolean, data?: any, error?: string }
  - 认证路由需要 @security JWT
  
  输出顺序：
  1. 接口定义
  2. 验证 Schema
  3. 路由代码
  4. 控制器代码
  5. 测试代码

post_process:
  - type: "format"
    command: "prettier --write"
```

**Step 3：测试和迭代**

第一轮测试：发现生成的代码缺少对未认证请求的 401 响应
→ 在模板中补充："如果路由需要认证，测试用例必须包含未认证访问的场景"

第二轮测试：发现 Zod schema 对可选字段的处理不一致
→ 在 context 中添加项目现有的 schema 示例

第三轮测试：发现 Swagger 文档缺少示例值
→ 在模板中要求："为每个字段提供合理的示例值"

**Step 4：团队共享**

将 Skill 发布到团队的 OpenCode 共享库：

```bash
opencode skill publish express-api-generator \
  --team my-team \
  --description "生成符合团队规范的 Express API"
```

## Skill 的进阶技巧

### 技巧 1：动态上下文

让 Skill 根据当前项目自动调整：

```yaml
context:
  dynamic:
    - type: "file_detection"
      description: "检测项目使用的 ORM"
      detection:
        "prisma/schema.prisma": "ORM=Prisma"
        "src/models/*.ts": "ORM=Sequelize"
        "mongoose": "ORM=Mongoose"
      default: "ORM=Raw SQL"
```

这样 Skill 在 Prisma 项目中会生成 Prisma 风格的代码，在 Sequelize 项目中会生成 Sequelize 风格的代码。

### 技巧 2：条件逻辑

根据输入参数调整行为：

```yaml
conditional:
  - if: "auth_required == true"
    then:
      add_context: "src/middleware/auth.ts"
      modify_template: "在路由中添加 authenticate middleware"
  - if: "caching == true"
    then:
      add_dependency: "redis"
      modify_template: "在控制器中添加缓存逻辑"
```

### 技巧 3：链式 Skill

让多个 Skill 协同工作：

```yaml
pipeline:
  - skill: "api-generator"
    output: "api_code"
  - skill: "test-generator"
    input: "$api_code"
    output: "test_code"
  - skill: "doc-generator"
    input: "$api_code"
    output: "documentation"
```

### 技巧 4：A/B 测试

对同一个 Skill 的不同版本进行对比：

```yaml
experiment:
  name: "template-optimization"
  variants:
    - name: "control"
      template: "v1_template"
    - name: "treatment"
      template: "v2_template"
  metric: "user_satisfaction_score"
  duration: "2_weeks"
```

## 团队 Skill 库管理

随着 Skill 数量增加，管理变得重要。我的管理策略：

### 目录结构

```
skills/
├── personal/           # 个人专用
│   ├── my-notes.md
│   └── my-workflow.yaml
├── team/               # 团队共享
│   ├── api-generator/
│   ├── component-generator/
│   └── code-review/
├── archived/           # 已废弃
│   └── old-react-skill/
└── experiments/        # 实验性
    └── new-ai-model/
```

### 版本管理

使用 Git 管理 Skill：

```bash
git add skills/
git commit -m "feat(skill): 优化 API Generator 的错误处理

- 新增对 422 Unprocessable Entity 的支持
- 修复可选字段的验证逻辑
- 提升测试覆盖率要求到 90%"
```

### 文档维护

每个 Skill 都需要说明文档：

```markdown
# Express API Generator

## 使用场景
创建新的 REST API 端点时

## 输入参数
- `entity`: 实体名称（如 User）
- `operations`: 操作列表（create, read, update, delete）
- `auth`: 是否需要认证

## 输出
- 路由文件
- 控制器文件
- 测试文件

## 示例
```
生成用户 API，支持 CRUD，需要认证
```

## 注意事项
- 会覆盖同名文件，请确认
- 生成的代码需要人工审查
```

## 常见问题

**Q: Skill 和普通的提示词模板有什么区别？**
A: Skill 是结构化的、可复用的、可共享的提示词系统。它包含触发条件、上下文注入、后处理等普通模板没有的能力。

**Q: 创建 Skill 需要编程能力吗？**
A: 基础 Skill 只需要理解 YAML 格式。复杂的 Skill 可能需要一些脚本知识，但大部分工作可以通过 GUI 完成。

**Q: Skill 会泄露敏感信息吗？**
A: OpenCode 的 Skill 系统支持本地存储和加密传输。对于敏感项目，建议自建 Skill 仓库，不共享到公共平台。

**Q: 一个项目应该有多少个 Skill？**
A: 质量比数量重要。建议从 3-5 个高频 Skill 开始，逐步积累。过多的 Skill 会增加选择成本。

## 结语

Skill 系统是 OpenCode 区别于其他 AI 编程工具的核心竞争力。它让 AI 从"通用的"变成了"专属的"，从"一次性的"变成了"可积累的"。

投入时间建立个人和团队的 Skill 库，是在 AI 时代建立竞争壁垒的有效方式。因为模型能力会越来越同质化，但**适配你工作流的 Skill 库是独一无二的**。

从今天开始，记录你重复的提示词，把它们转化为 Skill。三个月后，你会拥有一套真正懂你的 AI 开发环境。

毕竟，**最好的工具不是功能最多的，而是最懂你的**。
