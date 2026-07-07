---
name: code-demo-mode
description: 代码 demo 写作模式。用最小可跑代码 + 演进版本 + 调用链拆解，让读者通过"看代码跑起来"理解一个机制。
---

# 代码 Demo 模式

## 适用场景

- 单一机制需要"看到代码跑起来才懂"（如：KV cache、attention 计算、tokenizer、LoRA 注入）
- 推导文章中需要嵌入一段"骨架代码"
- 想验证自己对某个机制的理解是否正确

## 强制要求

| 要求 | 说明 |
|------|------|
| **真的能跑** | 不是伪代码。给出 `python xxx.py` 就能出结果的最小版本 |
| **两个版本** | 原始版（朴素实现）+ 升级版（引入关键抽象后）。体现演进 |
| **expected output** | README 里贴出真实跑过的输出。不准想象 |
| **解释调用链** | 代码后必须有一段"这段代码是怎么跑起来的"叙事 |
| **依赖最小** | 能用 numpy 不用 torch，能用 torch 不用 transformers，能用 transformers 不用 langchain |
| **行数克制** | 单文件 < 150 行。超出就是抽象不够 |

## 目录结构

```
themes/NN-slug/code/[demo-name]/
├── README.md           # 如何跑 + expected output + 解释
├── v1_naive.py         # 原始版本
├── v2_improved.py      # 升级版本
└── requirements.txt    # 锁定依赖版本
```

## README 模板

```markdown
# [Demo 名称]

> 一句话：这段代码解释了 [什么机制]

## 如何跑

\`\`\`bash
pip install -r requirements.txt
python v1_naive.py
python v2_improved.py
\`\`\`

## v1（原始版）

**做什么**：[一句话]

**为什么不够**：[一句话，引出 v2 的动机]

**Expected output**：
\`\`\`
[真跑出来的输出，原样贴]
\`\`\`

## v2（升级版）

**关键改动**：[一句话点出引入了什么抽象]

**为什么这样改**：[设计动机]

**Expected output**：
\`\`\`
[真跑出来的输出]
\`\`\`

## 调用链拆解

[从 main 进入开始，按调用顺序讲一遍代码是怎么流动的。可配 Mermaid 时序图]

## 对照真实实现

| 我的骨架 | 真实框架（如 transformers） | 差异 |
|---------|---------------------------|------|
| [节点 A] | [对应类/函数] | [何处简化] |
```

## 协作循环

1. 用户说要做某个机制的 demo
2. 先和用户确认：**这个 demo 要让读者看完后理解的"那一件事"是什么**？（一次只解释一件事，不要塞两个机制）
3. 写 v1，跑通，贴 output
4. 让用户读 v1 + output，确认"还没解决什么"
5. 写 v2，跑通，贴 output
6. 写调用链拆解
7. 写对照表

## 反例（不要这么做）

- ❌ 直接放完整框架代码（如 transformers 库源码片段）→ 读者看不懂
- ❌ 只有 v1 没有 v2 → 没有演进
- ❌ output 是 `# 类似 [xxx]` 这种描述 → 必须真跑
- ❌ 一个 demo 解释 3 个机制 → 拆成 3 个 demo
