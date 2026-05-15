---
layout: ../../layouts/ArticleLayout.astro
title: "Agent并发处理与并行计算"
lang: "zh-CN"
pubDate: 2026-02-11
updatedDate: 2026-02-11
description: "深入解析Agent架构中的并发模型选择、线程安全策略、资源竞争解决方案以及无锁设计等核心并发编程问题。"
author: "派"
tags: ["并发编程", "并行计算", "性能优化", "多线程"]
draft: false
---

现代Agent系统很少是单线程顺序执行的。一个复杂的任务往往涉及多个子任务，有些子任务之间没有依赖关系，可以并行处理；有些需要访问共享资源，必须串行化；还有些需要协调多个Worker的结果，涉及复杂的同步机制。并发处理是Agent架构的必答题，答得好，系统性能成倍提升；答不好，就会陷入死锁、数据竞争和性能瓶颈的泥潭。

这篇文章会从并发模型、线程安全、资源竞争、锁机制、无锁设计、并行算法和性能权衡七个维度，系统性地讲清楚Agent并发处理的方法论。

## 并发模型：选对武器

Agent系统的并发模型选择，直接影响代码的复杂度、可维护性和性能表现。常见的并发模型主要有四种：多线程、多进程、异步I/O和Actor模型。没有绝对最好的模型，只有最适合当前场景的模型。

多线程是最直观的并发方式。多个线程共享同一个进程的内存空间，通信成本低，但同步复杂。Python的GIL限制了多线程在CPU密集型任务上的并行能力，但对于I/O密集型任务（比如网络请求、文件读写），多线程仍然有效。Java、C++、Go等语言没有GIL限制，多线程的适用范围更广。

多进程通过操作系统隔离不同进程，每个进程有独立的内存空间。优点是稳定性高，一个进程崩溃不会影响其他进程；缺点是多进程间通信成本高，通常需要通过管道、队列或共享内存。

异步I/O（Async/Await）是目前最流行的高并发模型。它用单线程事件循环处理大量并发连接，通过非阻塞I/O避免线程切换开销。Node.js、Python的asyncio、Go的goroutine都是这个思路。异步模型特别适合I/O密集型的Agent系统，比如同时调用多个外部API、处理大量WebSocket连接。

Actor模型把并发单元抽象成独立的Actor，每个Actor有自己的状态和行为，通过消息传递通信。Actor之间不共享状态，从根本上避免了锁的问题。Erlang、Akka（Scala/Java）是这个模型的代表。在Agent系统中，每个Agent实例可以看作一个Actor，通过消息队列协调任务。

```typescript
// Actor模型的基本接口
interface Actor {
  readonly id: string;
  receive(message: Message): void;
  send(target: string, message: Message): void;
}

interface Message {
  type: string;
  payload: unknown;
  sender: string;
  timestamp: number;
}

class AgentActor implements Actor {
  private mailbox: Message[] = [];
  private processing = false;

  constructor(
    readonly id: string,
    private behavior: (msg: Message, self: AgentActor) => void
  ) {}

  receive(message: Message): void {
    this.mailbox.push(message);
    if (!this.processing) {
      this.processNext();
    }
  }

  private async processNext(): Promise<void> {
    this.processing = true;
    while (this.mailbox.length > 0) {
      const message = this.mailbox.shift()!;
      try {
        this.behavior(message, this);
      } catch (error) {
        console.error(`Actor ${this.id} failed to process message:`, error);
      }
    }
    this.processing = false;
  }

  send(target: string, message: Message): void {
    actorSystem.deliver(target, message);
  }
}
```

在实际项目中，我通常采用混合模型。主框架用异步I/O处理大量并发连接，CPU密集型任务用多进程隔离，需要强一致性的共享状态用细粒度锁保护。Actor模型适合Agent之间的协调通信，但不一定适合所有场景。

## 线程安全：共享状态是万恶之源

Agent系统中的共享状态来源很多：任务队列、会话缓存、配置中心、统计数据、限流计数器。这些共享状态如果被多个线程或协程同时访问，就会引发数据竞争（Data Race）。

数据竞争的典型表现是：两个线程同时读取和写入同一个变量，最终结果取决于两个操作的交错顺序，而不是代码逻辑。这种不确定性会让Bug极难复现和调试。

线程安全的根本原则是：要么不共享，要么只读，要么同步访问。

"不共享"是最简单的策略。每个Agent实例有自己的状态，不与其他实例共享。这种方式天然线程安全，但可能浪费内存，也不利于全局协调。

"只读"是次优策略。共享的状态一旦初始化就不再修改，所有访问都是读操作。多个线程同时读取没有竞争问题。在Agent系统中，配置信息、路由表、工具定义通常是只读的。

"同步访问"是最常用的策略。当必须共享可变状态时，用锁或其他同步机制保证同一时间只有一个线程在写。

```typescript
// 线程安全的任务队列
class ConcurrentTaskQueue<T> {
  private queue: T[] = [];
  private lock = new Mutex();
  private notEmpty = new Condition();

  async enqueue(task: T): Promise<void> {
    await this.lock.acquire();
    try {
      this.queue.push(task);
      this.notEmpty.signal();
    } finally {
      this.lock.release();
    }
  }

  async dequeue(): Promise<T> {
    await this.lock.acquire();
    try {
      while (this.queue.length === 0) {
        await this.notEmpty.wait(this.lock);
      }
      return this.queue.shift()!;
    } finally {
      this.lock.release();
    }
  }

  async size(): Promise<number> {
    await this.lock.acquire();
    try {
      return this.queue.length;
    } finally {
      this.lock.release();
    }
  }
}

// 简化版使用 async-mutex
import { Mutex } from "async-mutex";

class SimpleConcurrentQueue<T> {
  private queue: T[] = [];
  private mutex = new Mutex();

  async enqueue(task: T): Promise<void> {
    await this.mutex.runExclusive(() => {
      this.queue.push(task);
    });
  }

  async dequeue(): Promise<T | undefined> {
    return this.mutex.runExclusive(() => {
      return this.queue.shift();
    });
  }
}
```

除了显式锁，还可以用原子操作处理简单的计数器或标志位。原子操作由硬件保证不可分割，性能比锁更好，但只能操作简单的数据类型。

```typescript
// 使用 Atomics API 的原子计数器
class AtomicCounter {
  private value: Int32Array;

  constructor(initialValue: number = 0) {
    const buffer = new SharedArrayBuffer(4);
    this.value = new Int32Array(buffer);
    Atomics.store(this.value, 0, initialValue);
  }

  increment(): number {
    return Atomics.add(this.value, 0, 1);
  }

  decrement(): number {
    return Atomics.sub(this.value, 0, 1);
  }

  get(): number {
    return Atomics.load(this.value, 0);
  }

  compareAndSwap(expected: number, newValue: number): boolean {
    return Atomics.compareExchange(this.value, 0, expected, newValue) === expected;
  }
}
```

## 资源竞争：识别、隔离、限制

资源竞争发生在多个并发单元同时争夺有限的系统资源时。在Agent系统中，常见的竞争资源包括：数据库连接池、外部API配额、内存缓存、文件句柄、GPU算力。

资源竞争如果不加控制，会导致系统不稳定。比如十个Agent同时发起请求，瞬间耗尽连接池，后续请求全部超时；或者多个Agent同时写同一个日志文件，导致内容错乱。

解决资源竞争有三种策略：资源隔离、访问限制和背压机制。

资源隔离是把共享资源分配给不同的使用者，避免直接竞争。比如为每个Agent实例分配独立的数据库连接池，或者使用分片技术把缓存分散到多个节点。

访问限制是通过配额或速率限制，控制每个使用者对资源的消耗。这在调用外部API时尤其重要，因为外部服务的配额通常是硬约束。

```typescript
// 基于令牌桶的API配额管理
class ApiQuotaManager {
  private buckets = new Map<string, TokenBucket>();

  constructor(
    private quotas: Map<string, { rate: number; burst: number }>
  ) {
    for (const [api, config] of quotas) {
      this.buckets.set(api, new TokenBucket(config.burst, config.rate));
    }
  }

  async acquire(api: string, tokens: number = 1): Promise<void> {
    const bucket = this.buckets.get(api);
    if (!bucket) {
      throw new Error(`Unknown API: ${api}`);
    }
    await bucket.acquire(tokens);
  }

  getRemainingQuota(api: string): number {
    const bucket = this.buckets.get(api);
    return bucket ? bucket.getTokens() : 0;
  }
}

// 使用
const quotaManager = new ApiQuotaManager(new Map([
  ["openai", { rate: 10, burst: 20 }],      // 每秒10请求，突发20
  ["anthropic", { rate: 5, burst: 10 }],    // 每秒5请求，突发10
  ["google", { rate: 15, burst: 30 }]       // 每秒15请求，突发30
]));

// 在调用外部API前申请配额
await quotaManager.acquire("openai");
const result = await callOpenAI(prompt);
```

背压机制（Backpressure）是在系统负载过高时，主动拒绝或延迟新请求，防止资源耗尽。这在流式处理系统中很常见，但在Agent系统中同样适用。当任务队列长度超过阈值时，新任务应该被告知"系统繁忙，请稍后再试"，而不是无限制地排队。

```typescript
interface BackpressureStrategy {
  shouldAccept(task: Task, queueSize: number): boolean;
  getWaitTime(task: Task, queueSize: number): number;
}

class ThresholdBackpressure implements BackpressureStrategy {
  constructor(
    private softLimit: number,
    private hardLimit: number,
    private maxWaitMs: number
  ) {}

  shouldAccept(task: Task, queueSize: number): boolean {
    return queueSize < this.hardLimit;
  }

  getWaitTime(task: Task, queueSize: number): number {
    if (queueSize < this.softLimit) return 0;
    const ratio = (queueSize - this.softLimit) / (this.hardLimit - this.softLimit);
    return Math.min(ratio * this.maxWaitMs, this.maxWaitMs);
  }
}

class TaskAcceptor {
  constructor(
    private queue: ConcurrentTaskQueue<Task>,
    private backpressure: BackpressureStrategy
  ) {}

  async submit(task: Task): Promise<TaskReceipt> {
    const queueSize = await this.queue.size();

    if (!this.backpressure.shouldAccept(task, queueSize)) {
      throw new QueueFullError("系统负载过高，请稍后重试");
    }

    const waitTime = this.backpressure.getWaitTime(task, queueSize);
    if (waitTime > 0) {
      await sleep(waitTime);
    }

    await this.queue.enqueue(task);
    return { taskId: task.id, estimatedWait: waitTime };
  }
}
```

## 锁机制：细粒度与粗粒度的权衡

锁是保护共享状态的经典手段，但锁也是性能杀手。锁的粒度（granularity）决定了并发度：粒度太粗，很多本来可以并行的操作被串行化；粒度太细，锁的管理开销可能超过并行带来的收益。

常见的锁类型包括：互斥锁（Mutex）、读写锁（ReadWriteLock）、自旋锁（Spinlock）、递归锁（ReentrantLock）。

互斥锁是最基本的锁，同一时间只有一个线程能持有。适用于写操作频繁的场景。互斥锁的问题是会阻塞线程，如果持有锁的线程被操作系统调度出去，其他线程就只能干等。

读写锁区分读操作和写操作。多个线程可以同时读，但写操作必须独占。适用于读多写少的场景。在Agent系统中，配置缓存、工具注册表通常读远多于写，读写锁能显著提升并发度。

```typescript
// 读写锁的简单实现
class ReadWriteLock {
  private readers = 0;
  private writer = false;
  private queue: Array<() => void> = [];

  async acquireRead(): Promise<void> {
    return new Promise(resolve => {
      if (!this.writer && this.queue.length === 0) {
        this.readers++;
        resolve();
      } else {
        this.queue.push(() => {
          this.readers++;
          resolve();
        });
      }
    });
  }

  async acquireWrite(): Promise<void> {
    return new Promise(resolve => {
      if (this.readers === 0 && !this.writer) {
        this.writer = true;
        resolve();
      } else {
        this.queue.push(() => {
          this.writer = true;
          resolve();
        });
      }
    });
  }

  releaseRead(): void {
    this.readers--;
    if (this.readers === 0) {
      this.processQueue();
    }
  }

  releaseWrite(): void {
    this.writer = false;
    this.processQueue();
  }

  private processQueue(): void {
    while (this.queue.length > 0) {
      const next = this.queue[0];
      // 简化：按顺序处理
      next();
      this.queue.shift();
    }
  }
}

// 使用读写锁保护配置缓存
class ConfigCache {
  private cache = new Map<string, unknown>();
  private lock = new ReadWriteLock();

  async get(key: string): Promise<unknown | undefined> {
    await this.lock.acquireRead();
    try {
      return this.cache.get(key);
    } finally {
      this.lock.releaseRead();
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.lock.acquireWrite();
    try {
      this.cache.set(key, value);
    } finally {
      this.lock.releaseWrite();
    }
  }
}
```

自旋锁适用于极短时间的临界区。它不会让线程睡眠，而是不断尝试获取锁，直到成功。如果临界区很短（比如几个CPU指令），自旋锁比互斥锁更快，因为避免了线程上下文切换。但如果临界区较长，自旋锁会浪费大量CPU周期。

递归锁允许同一个线程多次获取同一个锁，而不会死锁。这在回调函数或递归调用中很有用，但要小心不要滥用，因为递归锁的语义比互斥锁复杂，容易出错。

锁的顺序是避免死锁的关键。如果多个线程需要获取多个锁，必须按照固定的顺序获取。比如线程A先锁X再锁Y，线程B也先锁X再锁Y，就不会死锁。如果线程B先锁Y再锁X，就可能发生死锁。

```typescript
// 死锁示例
async function deadlockExample() {
  const lockA = new Mutex();
  const lockB = new Mutex();

  // 线程1
  const task1 = async () => {
    await lockA.acquire();
    console.log("线程1获取锁A");
    await sleep(100);  // 模拟一些工作
    await lockB.acquire();  // 等待锁B
    console.log("线程1获取锁B");
    lockB.release();
    lockA.release();
  };

  // 线程2 - 相反的顺序！
  const task2 = async () => {
    await lockB.acquire();
    console.log("线程2获取锁B");
    await sleep(100);
    await lockA.acquire();  // 等待锁A - 死锁！
    console.log("线程2获取锁A");
    lockA.release();
    lockB.release();
  };

  await Promise.all([task1(), task2()]);
}

// 解决方案：统一获取顺序
async function safeExample() {
  const lockA = new Mutex();
  const lockB = new Mutex();

  const task1 = async () => {
    const [first, second] = [lockA, lockB].sort((a, b) => a.id.localeCompare(b.id));
    await first.acquire();
    await second.acquire();
    // ... 安全地访问共享资源
    second.release();
    first.release();
  };

  const task2 = async () => {
    const [first, second] = [lockA, lockB].sort((a, b) => a.id.localeCompare(b.id));
    await first.acquire();
    await second.acquire();
    // ... 安全地访问共享资源
    second.release();
    first.release();
  };
}
```

## 无锁设计：绕过锁的代价

无锁（Lock-free）数据结构不依赖传统的锁机制，而是通过原子操作和CAS（Compare-And-Swap）循环实现线程安全。无锁设计的优势是避免了线程阻塞和上下文切换，在高并发场景下性能更好。代价是代码更复杂，调试更困难，而且某些操作可能需要重试多次才能成功。

无锁队列是最常见的无锁数据结构之一。它用CAS操作维护队列的头尾指针，多个线程可以同时入队和出队而不需要锁。

```typescript
// 简化版无锁队列（Michael-Scott队列）
class LockFreeQueue<T> {
  private head: Node<T>;
  private tail: Node<T>;

  constructor() {
    const dummy = { value: null as T, next: null as Node<T> | null };
    this.head = dummy;
    this.tail = dummy;
  }

  enqueue(value: T): void {
    const newNode = { value, next: null };

    while (true) {
      const tail = this.tail;
      const next = tail.next;

      if (tail !== this.tail) continue;  // 尾指针已被其他线程更新

      if (next !== null) {
        // 尾指针落后了，尝试推进它
        Atomics.compareExchange(
          { value: this.tail } as any, 0, tail, next
        );
        continue;
      }

      // 尝试将新节点链接到尾部
      if (this.casNext(tail, null, newNode)) {
        // 成功，尝试更新尾指针
        Atomics.compareExchange(
          { value: this.tail } as any, 0, tail, newNode
        );
        return;
      }
    }
  }

  dequeue(): T | null {
    while (true) {
      const head = this.head;
      const tail = this.tail;
      const next = head.next;

      if (head !== this.head) continue;

      if (next === null) return null;  // 队列为空

      if (head === tail) {
        // 尾指针落后了
        Atomics.compareExchange(
          { value: this.tail } as any, 0, tail, next
        );
        continue;
      }

      const value = next.value;
      if (Atomics.compareExchange(
        { value: this.head } as any, 0, head, next
      ) === head) {
        return value;
      }
    }
  }

  private casNext(node: Node<T>, expected: null, newValue: Node<T>): boolean {
    // CAS操作实现
    return true; // 简化
  }
}

interface Node<T> {
  value: T | null;
  next: Node<T> | null;
}
```

无锁设计不适合所有场景。只有当锁竞争非常激烈、临界区很短、性能敏感时，才值得投入无锁设计的复杂度。对于大部分Agent系统，好的锁策略已经足够。

## 并行算法：让Agent多管齐下

并行算法是指把一个大的计算任务拆分成多个子任务，在多个处理器上同时执行，最后合并结果。在Agent系统中，并行算法主要应用在以下几个场景：批量数据处理、多源信息聚合、蒙特卡洛模拟、以及模型推理的批处理。

MapReduce是最经典的并行模式。Map阶段把输入数据拆分成小块，每块独立处理；Reduce阶段把中间结果合并成最终输出。Agent在分析大量文档时，可以用MapReduce模式：每个Worker分析一部分文档，最后汇总所有发现。

```typescript
// 并行文档分析
async function parallelDocumentAnalysis(
  documents: Document[],
  analyzer: (doc: Document) => Promise<AnalysisResult>,
  maxConcurrency: number = 4
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];
  const semaphore = new Semaphore(maxConcurrency);

  const tasks = documents.map(async (doc) => {
    await semaphore.acquire();
    try {
      const result = await analyzer(doc);
      results.push(result);
      return result;
    } finally {
      semaphore.release();
    }
  });

  await Promise.all(tasks);
  return results;
}

// 使用
const documents = await loadDocuments("./docs");
const findings = await parallelDocumentAnalysis(
  documents,
  async (doc) => {
    // 分析单个文档
    const issues = await analyzeCode(doc.content);
    return { file: doc.path, issues };
  },
  4  // 最多同时分析4个文档
);

// 汇总结果
const allIssues = findings.flatMap(f => f.issues);
console.log(`共发现 ${allIssues.length} 个问题`);
```

Fork-Join模式适合有依赖关系的并行任务。一个大任务被拆分成多个子任务，子任务可以再拆分，直到足够小。然后自底向上合并结果。这在Agent的树形任务分解中很有用，比如一个复杂任务先拆成三个子任务，每个子任务再各自拆分。

流水线模式（Pipeline）把任务分成多个阶段，每个阶段由独立的Worker处理，数据像流水一样从一个阶段流向下一个阶段。这在流式处理系统中很常见，但在Agent系统中也可以应用：输入解析、意图识别、工具选择、参数填充、结果生成，每个阶段可以并行处理不同的请求。

```typescript
// 流水线模式
class Pipeline<T, R> {
  private stages: Array<(input: unknown) => Promise<unknown>> = [];

  pipe<U>(stage: (input: R) => Promise<U>): Pipeline<T, U> {
    this.stages.push(stage as any);
    return this as any;
  }

  async process(input: T): Promise<R> {
    let result: unknown = input;
    for (const stage of this.stages) {
      result = await stage(result);
    }
    return result as R;
  }
}

// 使用流水线处理用户请求
const agentPipeline = new Pipeline<UserMessage, AgentResponse>()
  .pipe(async (msg) => parseMessage(msg as UserMessage))
  .pipe(async (parsed) => identifyIntent(parsed as ParsedMessage))
  .pipe(async (intent) => selectTools(intent as Intent))
  .pipe(async (tools) => executeTools(tools as SelectedTool[]))
  .pipe(async (results) => generateResponse(results as ToolResult[]));

const response = await agentPipeline.process(userMessage);
```

## 性能权衡：并发不是越多越好

并发带来的性能提升不是线性的。当并发度超过一定阈值后，继续增加并发反而会降低整体性能。这是因为并发有代价：上下文切换、锁竞争、内存开销、缓存失效。

上下文切换是操作系统在不同线程之间切换时保存和恢复状态的开销。当线程数量超过CPU核心数时，大量的时间被花在切换上，而不是实际工作上。

锁竞争是指多个线程同时争抢同一个锁。锁竞争越激烈，线程等待的时间越长。极端情况下，所有线程都在等锁，系统实际上退化成串行执行。

内存开销是指每个线程都需要自己的栈空间。在64位系统上，一个线程的默认栈大小通常是1MB到8MB。一千个线程就是1GB到8GB的内存，这还不包括堆上的数据。

缓存失效是指多个CPU核心同时访问不同的数据，导致CPU缓存频繁失效。现代CPU严重依赖缓存，缓存失效会让性能大幅下降。

所以并发度要设置上限。对于CPU密集型任务，并发度不应该超过CPU核心数。对于I/O密集型任务，并发度可以根据I/O等待时间和响应时间来估算。

Amdahl定律告诉我们，程序的加速比受限于串行部分的比例。如果一个任务有20%的部分必须串行执行，那么即使无限增加并行度，最大加速比也只有5倍。在Agent系统中，任务分解时要尽量减少串行依赖。

```typescript
// 动态并发控制
class AdaptiveConcurrency {
  private currentConcurrency: number;
  private targetLatency: number;
  private latencyHistory: number[] = [];

  constructor(
    initialConcurrency: number,
    targetLatencyMs: number
  ) {
    this.currentConcurrency = initialConcurrency;
    this.targetLatency = targetLatencyMs;
  }

  recordLatency(latencyMs: number): void {
    this.latencyHistory.push(latencyMs);
    if (this.latencyHistory.length > 10) {
      this.latencyHistory.shift();
    }
    this.adjustConcurrency();
  }

  private adjustConcurrency(): void {
    const avgLatency = this.latencyHistory.reduce((a, b) => a + b, 0)
      / this.latencyHistory.length;

    if (avgLatency > this.targetLatency * 1.2) {
      // 延迟过高，降低并发
      this.currentConcurrency = Math.max(1, this.currentConcurrency - 1);
    } else if (avgLatency < this.targetLatency * 0.8) {
      // 延迟过低，可以提高并发
      this.currentConcurrency += 1;
    }
  }

  getConcurrency(): number {
    return this.currentConcurrency;
  }
}
```

## 实际案例：多Agent协作的并发架构

假设我们要构建一个软件开发Agent团队，包含需求分析Agent、架构设计Agent、编码Agent、测试Agent和审查Agent。这些Agent需要协作完成一个软件项目的开发。

并发架构的核心是任务调度和结果同步。需求分析Agent完成后，架构设计Agent才能开始；架构设计完成后，编码Agent才能开始；但测试Agent可以在编码Agent完成部分模块后就开始测试，不必等全部完成。

我们用依赖图来管理任务关系：

```typescript
interface TaskNode {
  id: string;
  agent: string;
  dependencies: string[];
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
}

class DependencyGraph {
  private nodes = new Map<string, TaskNode>();
  private dependents = new Map<string, Set<string>>();

  addNode(node: TaskNode): void {
    this.nodes.set(node.id, node);
    for (const dep of node.dependencies) {
      if (!this.dependents.has(dep)) {
        this.dependents.set(dep, new Set());
      }
      this.dependents.get(dep)!.add(node.id);
    }
  }

  getReadyNodes(): TaskNode[] {
    return Array.from(this.nodes.values()).filter(node =>
      node.status === "pending" &&
      node.dependencies.every(dep =>
        this.nodes.get(dep)?.status === "completed"
      )
    );
  }

  markCompleted(nodeId: string, result: unknown): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = "completed";
      node.result = result;
    }
  }
}

// 构建开发工作流
const workflow = new DependencyGraph();

workflow.addNode({
  id: "analyze_requirements",
  agent: "requirement_analyst",
  dependencies: [],
  status: "pending"
});

workflow.addNode({
  id: "design_architecture",
  agent: "architect",
  dependencies: ["analyze_requirements"],
  status: "pending"
});

workflow.addNode({
  id: "implement_core",
  agent: "coder",
  dependencies: ["design_architecture"],
  status: "pending"
});

workflow.addNode({
  id: "implement_ui",
  agent: "coder",
  dependencies: ["design_architecture"],
  status: "pending"
});

workflow.addNode({
  id: "test_core",
  agent: "tester",
  dependencies: ["implement_core"],
  status: "pending"
});

workflow.addNode({
  id: "test_ui",
  agent: "tester",
  dependencies: ["implement_ui"],
  status: "pending"
});

workflow.addNode({
  id: "review",
  agent: "reviewer",
  dependencies: ["test_core", "test_ui"],
  status: "pending"
});
```

调度器负责并发执行没有依赖关系的任务：

```typescript
class WorkflowScheduler {
  private runningTasks = new Map<string, Promise<void>>();
  private maxConcurrency: number;

  constructor(
    private workflow: DependencyGraph,
    private agentPool: AgentPool,
    maxConcurrency: number = 3
  ) {
    this.maxConcurrency = maxConcurrency;
  }

  async execute(): Promise<void> {
    while (true) {
      const readyNodes = this.workflow.getReadyNodes();
      const runningCount = this.runningTasks.size;
      const availableSlots = this.maxConcurrency - runningCount;

      if (readyNodes.length === 0 && runningCount === 0) {
        break;  // 所有任务完成
      }

      // 启动尽可能多的就绪任务
      for (let i = 0; i < Math.min(readyNodes.length, availableSlots); i++) {
        const node = readyNodes[i];
        node.status = "running";
        const task = this.executeNode(node);
        this.runningTasks.set(node.id, task);
      }

      // 等待至少一个任务完成
      if (this.runningTasks.size > 0) {
        await Promise.race(this.runningTasks.values());
      }
    }
  }

  private async executeNode(node: TaskNode): Promise<void> {
    try {
      const agent = this.agentPool.acquire(node.agent);
      const dependencies = node.dependencies.map(dep =>
        this.workflow.getResult(dep)
      );

      const result = await agent.execute({
        task: node.id,
        context: dependencies
      });

      this.workflow.markCompleted(node.id, result);
    } catch (error) {
      node.status = "failed";
      console.error(`任务 ${node.id} 失败:`, error);
    } finally {
      this.runningTasks.delete(node.id);
    }
  }
}
```

这个架构中，需求分析和架构设计是串行的，但核心实现和UI实现可以并行，测试也可以在各自的模块完成后立即开始。通过依赖图管理任务关系，通过调度器控制并发度，整个系统既高效又可控。

## 总结与最佳实践

Agent系统的并发处理是一个多维度的问题，需要从模型选择、同步机制、资源管理和性能优化多个角度综合考虑。

**选择合适的并发模型**。I/O密集型用异步，CPU密集型用多进程，需要强隔离用Actor。不要试图用一种模型解决所有问题。

**最小化共享状态**。共享状态是并发Bug的温床。尽量让Agent实例无状态，状态存储在外部服务（数据库、缓存、消息队列）中。

**锁的粒度要适中**。太粗降低并发度，太细增加开销。从粗粒度开始，只在性能测试证明有瓶颈时才细化。

**统一锁的获取顺序**。如果必须获取多个锁，始终按固定顺序获取。这是避免死锁最简单有效的方法。

**使用高级并发原语**。不要自己实现锁和信号量，用经过充分测试的库。async-mutex、Semaphore、ReadWriteLock这些抽象比自己写更可靠。

**设置并发上限**。无论是线程数、协程数还是任务队列长度，都要有明确的上限。无限制的并发等于自杀。

**监控关键指标**。跟踪任务等待时间、锁持有时间、队列长度、资源利用率。这些数据是优化并发策略的基础。

**考虑背压和熔断**。当系统过载时，主动拒绝请求比被动崩溃更好。背压保护系统，熔断保护依赖。

**测试并发场景**。并发Bug很难通过常规测试发现。用压力测试、混沌工程和专门的并发测试框架（如Jepsen）来验证系统的正确性。

把这些原则应用到Agent系统的并发设计中，系统就能在保持正确性的前提下，充分利用多核和多机的计算能力，真正发挥并行处理的优势。