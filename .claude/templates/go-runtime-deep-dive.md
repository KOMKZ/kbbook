---
template-id: E02
name: go-runtime-deep-dive
description: Go runtime 深入模板。适合 GC、调度、逃逸、内存、锁、channel 等主题。
---

# E02 Go Runtime 深入模板

## 适用场景

- Go 代码行为看似简单,但背后由 runtime 决定。
- 需要用工具观察编译期或运行时。
- 需要解释性能、内存、并发问题。

## 文章骨架

```text
0. 为什么这个 runtime 机制会影响工程
1. 一个最小 Go 程序
2. 先观察:输出 / benchmark / pprof / trace
3. 心智模型:runtime 里哪些对象在协作
4. 源码或机制拆解
5. 改一个变量,现象如何变化
6. 常见误判
7. 排障速查
```

## 验证工具

按主题选择:

- 逃逸: `go test -gcflags=-m`
- 性能: `go test -bench`
- CPU/内存: `go tool pprof`
- 调度/阻塞: `go tool trace`
- GC: `GODEBUG=gctrace=1`
- 锁竞争: benchmark + pprof + trace

每个命令后必须解释输出中哪一行证明了什么。

## 禁止项

- 只贴 runtime 源码不解释工程意义。
- 只讲结论不跑程序。
- 把 Go 写成 Java/OOP 风格。
