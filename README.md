# KBBook / &#x4E66;&#x7C4D;

> **Your knowledge, in book form. Write with AI. Read anywhere. Sync via cloud.**

**KBBook** 把你用 AI 写出来的 Markdown 文章，变成一本可搜索、可离线阅读、可在平板上翻阅的"书"。支持 OSS 云端同步，写完自动推送到所有设备。

**KBBook** turns the Markdown articles you write with AI into a searchable, offline-capable "book" you can read on any device — including tablets. Cloud sync via OSS keeps everything up to date.

---

## &#x2728; Why KBBook? / &#x4E3A;&#x4EC0;&#x4E48;&#x7528; KBBook

| &#x4F60;&#x7684;&#x95EE;&#x9898; | KBBook &#x89E3;&#x51B3;&#x65B9;&#x6848; |
|-----------|---------------|
| &#x7528; AI &#x5199;&#x4E86;&#x5F88;&#x591A;&#x6587;&#x7AE0;&#xFF0C;&#x6563;&#x843D;&#x5728;&#x5404;&#x5904; | **&#x591A;&#x7CFB;&#x5217;&#x7EC4;&#x7EC7;** — &#x6309;&#x4E3B;&#x9898;&#x5F52;&#x7C7B;&#xFF0C;&#x5BFC;&#x822A;&#x76EE;&#x5F55;&#x81EA;&#x52A8;&#x751F;&#x6210; |
| &#x60F3;&#x5728;&#x5E73;&#x677F;&#x4E0A;&#x79BB;&#x7EBF;&#x770B;&#x6587;&#x7AE0; | **Android App** — &#x6253;&#x5305;&#x6210; APK&#xFF0C;&#x79BB;&#x7EBF;&#x968F;&#x65F6;&#x770B; |
| &#x6587;&#x7AE0;&#x66F4;&#x65B0;&#x4E86;&#xFF0C;&#x5E73;&#x677F;&#x770B;&#x4E0D;&#x5230; | **OSS &#x4E91;&#x7AEF;&#x540C;&#x6B65;** — &#x4E00;&#x952E;&#x4E0A;&#x4F20;&#xFF0C;&#x6240;&#x6709;&#x8BBE;&#x5907;&#x81EA;&#x52A8;&#x66F4;&#x65B0; |
| &#x6280;&#x672F;&#x6587;&#x7AE0;&#x6CA1;&#x56FE;&#x6CA1;&#x516C;&#x5F0F;&#x592A;&#x5E72; | **Mermaid + KaTeX** — &#x6D41;&#x7A0B;&#x56FE;&#x3001;&#x6570;&#x5B66;&#x516C;&#x5F0F;&#x539F;&#x751F;&#x6E32;&#x67D3; |
| &#x6587;&#x7AE0;&#x591A;&#x4E86;&#x627E;&#x4E0D;&#x5230; | **&#x5168;&#x6587;&#x641C;&#x7D22;** — &#x79BB;&#x7EBF;&#x9759;&#x6001;&#x7D22;&#x5F15;&#xFF0C;&#x6BEB;&#x79D2;&#x7EA7; |
| &#x4E0D;&#x60F3;&#x642D;&#x540E;&#x7AEF;&#x3001;&#x4E0D;&#x60F3;&#x5F04;&#x6570;&#x636E;&#x5E93; | **&#x96F6;&#x8FD0;&#x884C;&#x65F6;&#x4F9D;&#x8D56;** — &#x7EAF;&#x9759;&#x6001;&#x6587;&#x4EF6;&#xFF0C;&#x6254;&#x5230; Nginx/OSS/Pages &#x5C31;&#x884C; |

## &#x26A1; Quick Start / &#x5FEB;&#x901F;&#x5F00;&#x59CB;

```bash
git clone https://github.com/KOMKZ/kbbook.git
cd kbbook
pnpm install && pnpm dev
```

Open `http://localhost:3004` — you're live. &#x6253;&#x5F00;&#x5373;&#x7528;&#x3002;

## &#x1F4D6; Write with AI / &#x7528; AI &#x5199;&#x4F5C;

&#x8FD9;&#x662F; KBBook &#x6700;&#x5927;&#x7684;&#x4EAE;&#x70B9;&#xFF1A;

1. &#x7528; Claude / ChatGPT / &#x4EFB;&#x610F; AI &#x5DE5;&#x5177;&#x5BF9;&#x8BDD;&#x5199;&#x6587;&#x7AE0;
2. &#x4FDD;&#x5B58;&#x4E3A; `.md` &#x6587;&#x4EF6;&#xFF0C;&#x6254;&#x5230; `public/docs/` &#x76EE;&#x5F55;
3. &#x66F4;&#x65B0; `_meta.json` &#x76EE;&#x5F55;
4. &#x5237;&#x65B0;&#x9875;&#x9762; — &#x6587;&#x7AE0;&#x5C31;&#x5728;&#x4F60;&#x7684;&#x4E66;&#x7C4D;&#x91CC;&#x4E86;

&#x9879;&#x76EE;&#x5185;&#x7F6E;&#x4E86;**&#x5199;&#x4F5C;&#x6A21;&#x677F;**&#x548C; **AI Agent &#x6307;&#x4EE4;**&#xFF0C;&#x544A;&#x8BC9; AI &#x600E;&#x4E48;&#x5199;&#x51FA;&#x63A8;&#x5BFC;&#x5F0F;&#x3001;&#x6709;&#x6DF1;&#x5EA6;&#x7684;&#x6280;&#x672F;&#x6587;&#x7AE0;&#x3002;&#x89C1; `.claude/agents/` &#x548C; `.claude/templates/`&#x3002;

## &#x1F4F1; Offline App / &#x79BB;&#x7EBF; App

```bash
make verify-app
```

&#x4E00;&#x6761;&#x547D;&#x4EE4;&#xFF1A;&#x6784;&#x5EFA; APK &#x2192; &#x5185;&#x5BB9;&#x9A8C;&#x8BC1; &#x2192; &#x5B89;&#x88C5;&#x5230;&#x5E73;&#x677F; &#x2192; &#x542F;&#x52A8;&#x9A8C;&#x8BC1;&#x3002;&#x5E73;&#x677F;&#x65E0;&#x7F51;&#x4E5F;&#x80FD;&#x770B;&#xFF0C;&#x5B8C;&#x6574;&#x652F;&#x6301; Mermaid &#x56FE;&#x8868;&#x3001;KaTeX &#x516C;&#x5F0F;&#x3001;&#x4EE3;&#x7801;&#x9AD8;&#x4EAE;&#x3002;

## &#x2601;&#xFE0F; OSS Cloud Sync / &#x4E91;&#x7AEF;&#x540C;&#x6B65;

```bash
make upload-to-oss
```

&#x6587;&#x7AE0;&#x5199;&#x5B8C;&#xFF0C;&#x4E00;&#x952E;&#x4E0A;&#x4F20;&#x5230;&#x963F;&#x91CC;&#x4E91; OSS&#x3002;&#x5E73;&#x677F; App &#x81EA;&#x52A8;&#x68C0;&#x6D4B;&#x66F4;&#x65B0;&#xFF0C;&#x4E0B;&#x6B21;&#x6253;&#x5F00;&#x5C31;&#x662F;&#x6700;&#x65B0;&#x7248;&#x3002;&#x4E0D;&#x7528;&#x91CD;&#x65B0;&#x6253;&#x5305; APK&#x3002;

## &#x1F50D; One-Click Health Check / &#x4E00;&#x952E;&#x68C0;&#x6D4B;

```bash
make check-content          # &#x9A8C;&#x8BC1;&#x4F60;&#x7684;&#x6587;&#x7AE0;&#x5B8C;&#x6574;&#xFF0C;&#x6CA1;&#x88AB;&#x8986;&#x76D6;
make check-sensitive        # &#x626B;&#x63CF;&#x654F;&#x611F;&#x4FE1;&#x606F;&#xFF0C;&#x5B89;&#x5168;&#x63A8;&#x9001;
```

&#x4E24;&#x6761;&#x547D;&#x4EE4;&#xFF0C;&#x786E;&#x4FDD;&#x5185;&#x5BB9;&#x5B8C;&#x6574;&#x3001;&#x65E0;&#x5BC6;&#x94A5;&#x6CC4;&#x9732;&#x3002;

## &#x1F4E6; Project Structure / &#x9879;&#x76EE;&#x7ED3;&#x6784;

```text
kbbook/
├── public/docs/           ← &#x4F60;&#x7684;&#x6587;&#x7AE0;&#x653E;&#x8FD9;&#x91CC;
│   ├── series.json        # &#x7CFB;&#x5217;&#x6CE8;&#x518C;
│   ├── versions.json      # &#x7248;&#x672C;&#x914D;&#x7F6E;
│   └── zh-CN/
│       └── my-series-v0.1.0/
│           ├── _meta.json  # &#x5BFC;&#x822A;&#x76EE;&#x5F55;
│           ├── 01-intro.md
│           └── 02-advanced.md
├── src/                   # React &#x6E90;&#x7801; (&#x4E0D;&#x7528;&#x6539;)
├── scripts/               # &#x7BA1;&#x7406;&#x811A;&#x672C;
├── .claude/               # AI &#x5199;&#x4F5C; Agent + &#x6A21;&#x677F;
└── Makefile               # &#x4E00;&#x5207;&#x64CD;&#x4F5C;&#x7684;&#x5165;&#x53E3;
```

## &#x1F9B0; Tech Stack / &#x6280;&#x672F;&#x6808;

React 18 + TypeScript + Material UI + Vite + Capacitor (Android)

&#x2014;

&#x4F60;&#x53EA;&#x9700;&#x8981;&#x5173;&#x6CE8; `public/docs/` &#x76EE;&#x5F55;&#x3002;&#x5199;&#x6587;&#x7AE0;&#xFF0C;&#x66F4;&#x65B0;&#x76EE;&#x5F55;&#xFF0C;&#x4E00;&#x952E;&#x540C;&#x6B65;&#x3002;&#x5176;&#x4ED6;&#x7684;&#xFF0C;KBBook &#x5E2E;&#x4F60;&#x641E;&#x5B9A;&#x3002;
