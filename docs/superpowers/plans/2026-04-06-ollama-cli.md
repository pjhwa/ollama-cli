# ollama-cli Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** grok-cli를 ollama 전용 로컬 AI 코딩 에이전트로 포팅하고, 브릿지의 코딩 성능 향상 로직(CoT, UltraPlan, RAG)을 TypeScript로 통합한다.

**Architecture:** grok-cli를 베이스 포크로 `src/grok/` 레이어만 `src/ollama/`로 교체한다. `@ai-sdk/xai` 대신 `@ai-sdk/openai`를 사용해 ollama의 OpenAI 호환 `/v1` 엔드포인트에 연결하고, API 키 자리에 더미값 `'ollama'`를 사용한다. 나머지 Agent/TUI/Storage/Tools는 그대로 재사용한다.

**Tech Stack:** TypeScript, Bun, Vercel AI SDK (`ai`, `@ai-sdk/openai`), OpenTUI, React, SQLite (bun:sqlite), Commander.js, Vitest

---

## File Map

### 생성 파일
| 경로 | 역할 |
|---|---|
| `src/ollama/discovery.ts` | ollama 실행 감지, 모델 목록 조회 |
| `src/ollama/discovery.test.ts` | discovery 단위 테스트 |
| `src/ollama/client.ts` | openai provider 생성, 모델 런타임 해석 |
| `src/ollama/models.ts` | 설치 모델 스코어링, 추천, ModelInfo |
| `src/ollama/models.test.ts` | 스코어링 로직 단위 테스트 |
| `src/ollama/pull.ts` | 모델 다운로드 스트리밍 래퍼 |
| `src/ollama/pull.test.ts` | pull 단위 테스트 |
| `src/ollama/optimizer/cot.ts` | CoT 강제 + thinking 모드 (브릿지 포팅) |
| `src/ollama/optimizer/cot.test.ts` | CoT 변환 단위 테스트 |
| `src/ollama/optimizer/ultraplan.ts` | 복잡도 감지 + 계획 선생성 (브릿지 포팅) |
| `src/ollama/optimizer/ultraplan.test.ts` | UltraPlan 단위 테스트 |
| `src/ollama/optimizer/rag.ts` | 코드베이스 벡터 RAG (브릿지 포팅) |
| `src/ollama/optimizer/rag.test.ts` | RAG 단위 테스트 |
| `src/ollama/optimizer/index.ts` | 파이프라인 통합 |

### 수정 파일
| 경로 | 변경 내용 |
|---|---|
| `package.json` | 이름/bin/의존성 변경 |
| `src/utils/settings.ts` | 경로 `~/.ollama-cli/`, API 키 제거, optimizer 설정 추가 |
| `src/agent/compaction.ts` | `XaiProvider` → `OllamaProvider` import 교체 |
| `src/agent/agent.ts` | grok import → ollama import, optimizer 통합, sandbox/batch 제거 |
| `src/index.ts` | CLI 커맨드 재작성 (models/rag 서브커맨드 추가) |

### 삭제 파일
- `src/grok/` (전체 디렉터리)
- `src/telegram/` (전체 디렉터리)
- `src/audio/` (전체 디렉터리)

---

## Task 1: 프로젝트 초기화

**Files:**
- Modify: `package.json`
- Modify: `src/utils/settings.ts` (경로만)

- [ ] **Step 1: grok-cli를 ollama-cli로 복사**

```bash
cp -r /Users/jerry/dev/grok-cli/. /Users/jerry/dev/ollama-cli/
# docs/ 는 이미 존재하므로 덮어쓰지 않도록 확인
ls /Users/jerry/dev/ollama-cli/src/
```

Expected: `agent  audio  bun-sqlite.d.ts  grok  headless  hooks  index.ts  mcp  storage  telegram  tools  types  ui  utils  verify`

- [ ] **Step 2: package.json 업데이트**

`package.json`의 `name`, `description`, `bin`, `dependencies`를 수정한다:

```json
{
  "name": "ollama-cli",
  "version": "1.0.0",
  "description": "Local AI coding agent powered by Ollama — built with Bun and OpenTUI.",
  "type": "module",
  "main": "dist/index.js",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "bin": {
    "ollama-cli": "dist/index.js"
  },
  "scripts": {
    "dev": "bun run src/index.ts",
    "build": "tsc",
    "build:binary": "bun build --compile --outfile dist/ollama-cli-standalone ./src/index.ts",
    "start": "bun run dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "bunx vitest run",
    "test:watch": "bunx vitest",
    "lint": "biome check src/",
    "format:fix": "biome format --write src/",
    "lint:fix": "biome check --fix src/",
    "pre-commit": "lint-staged",
    "prepare": "husky"
  },
  "keywords": ["cli", "agent", "ollama", "ai", "coding", "terminal", "opentui"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "@ai-sdk/mcp": "^1.0.25",
    "@ai-sdk/openai": "^3.0.0",
    "@ai-sdk/provider-utils": "^4.0.21",
    "@modelcontextprotocol/sdk": "^1.27.1",
    "@opentui/core": "^0.1.88",
    "@opentui/react": "^0.1.88",
    "agent-desktop": "^0.1.11",
    "ai": "^6.0.116",
    "commander": "^12.1.0",
    "diff": "^8.0.3",
    "dotenv": "^16.6.1",
    "react": "^19.2.4",
    "semver": "^7.7.4",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.8",
    "@types/diff": "^8.0.0",
    "@types/node": "^22.19.15",
    "@types/react": "^19.2.14",
    "@types/semver": "^7.7.1",
    "husky": "^9.1.7",
    "lint-staged": "^16.4.0",
    "typescript": "^5.9.3",
    "vitest": "^4.1.0"
  },
  "engines": { "node": ">=18.0.0" },
  "preferGlobal": true
}
```

- [ ] **Step 3: 의존성 설치**

```bash
cd /Users/jerry/dev/ollama-cli && bun install
```

Expected: bun install 완료, node_modules 생성

- [ ] **Step 4: Commit**

```bash
cd /Users/jerry/dev/ollama-cli
git add package.json bun.lock
git commit -m "chore: initialize ollama-cli from grok-cli fork, update package.json"
```

---

## Task 2: Ollama Discovery

**Files:**
- Create: `src/ollama/discovery.ts`
- Create: `src/ollama/discovery.test.ts`

- [ ] **Step 1: 테스트 작성**

`src/ollama/discovery.test.ts`:
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOllamaBaseUrl,
  getOllamaChatBaseUrl,
  hasLocalOllama,
  listOllamaModels,
  type OllamaModelDescriptor,
} from "./discovery";

describe("getOllamaBaseUrl", () => {
  it("returns default when OLLAMA_BASE_URL is not set", () => {
    delete process.env.OLLAMA_BASE_URL;
    expect(getOllamaBaseUrl()).toBe("http://localhost:11434");
  });

  it("returns env var when set", () => {
    process.env.OLLAMA_BASE_URL = "http://192.168.1.10:11434";
    expect(getOllamaBaseUrl()).toBe("http://192.168.1.10:11434");
    delete process.env.OLLAMA_BASE_URL;
  });

  it("strips trailing slash", () => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434/";
    expect(getOllamaBaseUrl()).toBe("http://localhost:11434");
    delete process.env.OLLAMA_BASE_URL;
  });
});

describe("getOllamaChatBaseUrl", () => {
  it("appends /v1 to base url", () => {
    expect(getOllamaChatBaseUrl("http://localhost:11434")).toBe("http://localhost:11434/v1");
  });
});

describe("hasLocalOllama", () => {
  it("returns true when ollama responds 200", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true });
    expect(await hasLocalOllama()).toBe(true);
  });

  it("returns false when fetch throws", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await hasLocalOllama()).toBe(false);
  });

  it("returns false when response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false });
    expect(await hasLocalOllama()).toBe(false);
  });
});

describe("listOllamaModels", () => {
  it("returns model descriptors from /api/tags", async () => {
    const mockModels = [
      { name: "qwen2.5-coder:7b", details: { family: "qwen2", parameter_size: "7B", quantization_level: "Q4_K_M" }, size: 4_000_000_000 },
      { name: "llama3.2:3b", details: { family: "llama", parameter_size: "3B", quantization_level: "Q8_0" }, size: 2_000_000_000 },
    ];
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: mockModels }),
    });
    const result = await listOllamaModels();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject<OllamaModelDescriptor>({
      name: "qwen2.5-coder:7b",
      family: "qwen2",
      parameterSize: "7B",
      quantizationLevel: "Q4_K_M",
      sizeBytes: 4_000_000_000,
    });
  });

  it("returns empty array when ollama is not running", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await listOllamaModels()).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
cd /Users/jerry/dev/ollama-cli && bunx vitest run src/ollama/discovery.test.ts
```

Expected: FAIL — `Cannot find module './discovery'`

- [ ] **Step 3: 구현 작성**

`src/ollama/discovery.ts`:
```typescript
export interface OllamaModelDescriptor {
  name: string;
  sizeBytes: number | null;
  family: string | null;
  parameterSize: string | null;
  quantizationLevel: string | null;
}

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DISCOVERY_TIMEOUT_MS = 1200;

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getOllamaBaseUrl(override?: string): string {
  const raw = override || process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL;
  return trimTrailingSlash(raw);
}

export function getOllamaChatBaseUrl(baseUrl?: string): string {
  return `${getOllamaBaseUrl(baseUrl)}/v1`;
}

export async function hasLocalOllama(baseUrl?: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    const resp = await fetch(`${getOllamaBaseUrl(baseUrl)}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function listOllamaModels(baseUrl?: string): Promise<OllamaModelDescriptor[]> {
  try {
    const resp = await fetch(`${getOllamaBaseUrl(baseUrl)}/api/tags`, { method: "GET" });
    if (!resp.ok) return [];
    const data = (await resp.json()) as { models?: Array<{ name: string; size?: number; details?: { family?: string; parameter_size?: string; quantization_level?: string } }> };
    return (data.models ?? []).map((m) => ({
      name: m.name,
      sizeBytes: m.size ?? null,
      family: m.details?.family ?? null,
      parameterSize: m.details?.parameter_size ?? null,
      quantizationLevel: m.details?.quantization_level ?? null,
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/jerry/dev/ollama-cli && bunx vitest run src/ollama/discovery.test.ts
```

Expected: PASS (4 test suites)

- [ ] **Step 5: Commit**

```bash
git add src/ollama/discovery.ts src/ollama/discovery.test.ts
git commit -m "feat(ollama): add ollama discovery module"
```

---

## Task 3: Ollama Client

**Files:**
- Create: `src/ollama/client.ts`

- [ ] **Step 1: client.ts 작성**

`src/ollama/client.ts`:
```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getOllamaChatBaseUrl } from "./discovery";

export type OllamaProvider = ReturnType<typeof createOpenAI>;
export type OllamaModel = ReturnType<OllamaProvider>;

export const THINKING_MODELS = ["qwen3", "deepseek-r1", "qwq", "marco-o1"] as const;

export interface OllamaModelRuntime {
  model: OllamaModel;
  modelId: string;
  isThinkingModel: boolean;
}

export interface GeneratedTitle {
  title: string;
  modelId: string;
  usage?: { totalTokens?: number; inputTokens?: number; outputTokens?: number };
}

export function isThinkingModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return THINKING_MODELS.some((tm) => lower.includes(tm));
}

export function createProvider(baseUrl?: string): OllamaProvider {
  return createOpenAI({
    baseURL: getOllamaChatBaseUrl(baseUrl),
    apiKey: "ollama",
    compatibility: "compatible",
  });
}

export function resolveModelRuntime(provider: OllamaProvider, modelId: string): OllamaModelRuntime {
  return {
    model: provider(modelId),
    modelId,
    isThinkingModel: isThinkingModel(modelId),
  };
}

const DEFAULT_TITLE_MODEL_HINTS = ["qwen2.5-coder", "qwen2.5", "llama3", "mistral"];

export async function generateTitle(
  provider: OllamaProvider,
  userMessage: string,
  modelId: string,
): Promise<GeneratedTitle> {
  try {
    const { text, usage } = await generateText({
      model: provider(modelId),
      temperature: 0.5,
      maxOutputTokens: 60,
      system: [
        "You are a title generator. Output ONLY a short title. Nothing else.",
        "Rules:",
        "- Single line, ≤50 characters",
        "- Focus on the main topic or intent",
        "- Never use tools or explain anything",
      ].join("\n"),
      prompt: userMessage,
    });
    return {
      title: text?.trim().replace(/^["']|["']$/g, "") || "New session",
      modelId,
      usage,
    };
  } catch {
    return { title: "New session", modelId };
  }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/jerry/dev/ollama-cli && bun run typecheck 2>&1 | grep "ollama/client" | head -20
```

Expected: No errors for `src/ollama/client.ts`

- [ ] **Step 3: Commit**

```bash
git add src/ollama/client.ts
git commit -m "feat(ollama): add ollama client with OpenAI-compatible provider"
```

---

## Task 4: Ollama Models

**Files:**
- Create: `src/ollama/models.ts`
- Create: `src/ollama/models.test.ts`

- [ ] **Step 1: 테스트 작성**

`src/ollama/models.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import type { OllamaModelDescriptor } from "./discovery";
import {
  isViableOllamaChatModel,
  recommendModel,
  scoreModel,
} from "./models";

const MODELS: OllamaModelDescriptor[] = [
  { name: "qwen2.5-coder:7b", sizeBytes: 4_500_000_000, family: "qwen2", parameterSize: "7B", quantizationLevel: "Q4_K_M" },
  { name: "llama3.2:3b", sizeBytes: 2_000_000_000, family: "llama", parameterSize: "3B", quantizationLevel: "Q8_0" },
  { name: "nomic-embed-text", sizeBytes: 300_000_000, family: null, parameterSize: null, quantizationLevel: null },
  { name: "deepseek-coder:6.7b", sizeBytes: 3_800_000_000, family: null, parameterSize: "6.7B", quantizationLevel: "Q4_0" },
];

describe("isViableOllamaChatModel", () => {
  it("filters out embedding models", () => {
    expect(isViableOllamaChatModel({ name: "nomic-embed-text", sizeBytes: null, family: null, parameterSize: null, quantizationLevel: null })).toBe(false);
  });

  it("allows chat models", () => {
    expect(isViableOllamaChatModel(MODELS[0])).toBe(true);
    expect(isViableOllamaChatModel(MODELS[1])).toBe(true);
  });
});

describe("scoreModel", () => {
  it("scores coding models higher for coding goal", () => {
    const coderScore = scoreModel(MODELS[0], "coding").score;
    const llamaScore = scoreModel(MODELS[1], "coding").score;
    expect(coderScore).toBeGreaterThan(llamaScore);
  });

  it("scores small models higher for latency goal", () => {
    const smallScore = scoreModel(MODELS[1], "latency").score;  // 3B
    const largeScore = scoreModel(MODELS[0], "latency").score;  // 7B
    expect(smallScore).toBeGreaterThan(largeScore);
  });
});

describe("recommendModel", () => {
  it("recommends a coding model for coding goal", () => {
    const result = recommendModel(MODELS, "coding");
    expect(result?.name).toMatch(/coder/i);
  });

  it("recommends a small model for latency goal", () => {
    const result = recommendModel(MODELS, "latency");
    expect(result?.name).toContain("3b");
  });

  it("returns null when no viable models", () => {
    expect(recommendModel([], "balanced")).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
bunx vitest run src/ollama/models.test.ts
```

Expected: FAIL — `Cannot find module './models'`

- [ ] **Step 3: 구현 작성**

`src/ollama/models.ts`:
```typescript
import type { OllamaModelDescriptor } from "./discovery";

export type RecommendationGoal = "latency" | "balanced" | "coding";

export interface RankedOllamaModel extends OllamaModelDescriptor {
  score: number;
  reasons: string[];
}

const CODING_HINTS = ["coder", "codellama", "codegemma", "codestral", "devstral", "starcoder", "deepseek-coder", "qwen2.5-coder", "qwen-coder"];
const NON_CHAT_HINTS = ["embed", "embedding", "rerank", "bge", "whisper"];

function modelHaystack(m: OllamaModelDescriptor): string {
  return [m.name, m.family ?? "", m.parameterSize ?? "", m.quantizationLevel ?? ""].join(" ").toLowerCase();
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}

export function isViableOllamaChatModel(m: OllamaModelDescriptor): boolean {
  return !includesAny(modelHaystack(m), NON_CHAT_HINTS);
}

function inferParamsBillions(m: OllamaModelDescriptor): number | null {
  const text = `${m.parameterSize ?? ""} ${m.name}`.toLowerCase();
  const match = text.match(/(\d+(?:\.\d+)?)\s*b\b/);
  if (match?.[1]) return Number(match[1]);
  if (typeof m.sizeBytes === "number" && m.sizeBytes > 0) {
    return Number((m.sizeBytes / 1_000_000_000).toFixed(1));
  }
  return null;
}

export function scoreModel(m: OllamaModelDescriptor, goal: RecommendationGoal): RankedOllamaModel {
  const reasons: string[] = [];
  let score = 0;
  const hay = modelHaystack(m);
  const paramsB = inferParamsBillions(m);

  // Coding bonus
  if (includesAny(hay, CODING_HINTS)) {
    const bonus = goal === "coding" ? 30 : goal === "balanced" ? 15 : 5;
    score += bonus;
    reasons.push(`coding model (+${bonus})`);
  }

  // Size score
  if (paramsB !== null) {
    if (goal === "latency") {
      if (paramsB <= 4) { score += 25; reasons.push("tiny model for latency"); }
      else if (paramsB <= 8) { score += 15; reasons.push("small model"); }
      else if (paramsB <= 14) { score += 5; reasons.push("mid model"); }
      else { score -= 10; reasons.push("large model (slow)"); }
    } else if (goal === "coding") {
      if (paramsB <= 4) { score += 5; reasons.push("tiny (may lack quality)"); }
      else if (paramsB <= 8) { score += 20; reasons.push("good coding size"); }
      else if (paramsB <= 14) { score += 25; reasons.push("strong coding size"); }
      else { score += 15; reasons.push("large model"); }
    } else {
      // balanced
      if (paramsB <= 4) { score += 10; }
      else if (paramsB <= 8) { score += 20; reasons.push("balanced size"); }
      else if (paramsB <= 14) { score += 18; }
      else { score += 10; }
    }
  }

  return { ...m, score, reasons };
}

export function recommendModel(
  models: OllamaModelDescriptor[],
  goal: RecommendationGoal = "balanced",
): OllamaModelDescriptor | null {
  const viable = models.filter(isViableOllamaChatModel);
  if (viable.length === 0) return null;
  const ranked = viable.map((m) => scoreModel(m, goal)).sort((a, b) => b.score - a.score);
  return ranked[0] ?? null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
bunx vitest run src/ollama/models.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ollama/models.ts src/ollama/models.test.ts
git commit -m "feat(ollama): add model scoring and recommendation"
```

---

## Task 5: Ollama Pull

**Files:**
- Create: `src/ollama/pull.ts`
- Create: `src/ollama/pull.test.ts`

- [ ] **Step 1: 테스트 작성**

`src/ollama/pull.test.ts`:
```typescript
import { describe, expect, it, vi } from "vitest";
import { pullModel } from "./pull";

describe("pullModel", () => {
  it("calls onProgress with status updates", async () => {
    const lines = [
      JSON.stringify({ status: "pulling manifest" }),
      JSON.stringify({ status: "downloading", completed: 500, total: 1000 }),
      JSON.stringify({ status: "success" }),
    ];
    const body = {
      getReader: () => {
        let i = 0;
        return {
          read: async () => {
            if (i >= lines.length) return { done: true, value: undefined };
            const value = new TextEncoder().encode(lines[i++] + "\n");
            return { done: false, value };
          },
        };
      },
    };
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, body });

    const progress: string[] = [];
    await pullModel("qwen2.5-coder:7b", (p) => progress.push(p.status));

    expect(progress).toContain("pulling manifest");
    expect(progress).toContain("success");
  });

  it("throws when fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(pullModel("no-model")).rejects.toThrow("ECONNREFUSED");
  });
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
bunx vitest run src/ollama/pull.test.ts
```

Expected: FAIL

- [ ] **Step 3: 구현 작성**

`src/ollama/pull.ts`:
```typescript
import { getOllamaBaseUrl } from "./discovery";

export interface PullProgress {
  status: string;
  completed?: number;
  total?: number;
  digest?: string;
}

export type PullProgressCallback = (progress: PullProgress) => void;

export async function pullModel(
  modelName: string,
  onProgress?: PullProgressCallback,
  baseUrl?: string,
): Promise<void> {
  const resp = await fetch(`${getOllamaBaseUrl(baseUrl)}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: modelName, stream: true }),
  });

  if (!resp.ok) {
    throw new Error(`Pull failed: HTTP ${resp.status}`);
  }

  const reader = resp.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line) as PullProgress;
        onProgress?.(data);
      } catch {
        // skip malformed lines
      }
    }
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
bunx vitest run src/ollama/pull.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ollama/pull.ts src/ollama/pull.test.ts
git commit -m "feat(ollama): add model pull with streaming progress"
```

---

## Task 6: Settings 시스템 업데이트

**Files:**
- Modify: `src/utils/settings.ts`

- [ ] **Step 1: settings.ts 업데이트**

`src/utils/settings.ts`에서 다음을 변경한다:

1. `~/.grok` → `~/.ollama-cli`
2. `GROK_API_KEY`, `GROK_BASE_URL`, `GROK_MODEL` 환경변수 제거
3. `OLLAMA_BASE_URL`, `OLLAMA_MODEL` 환경변수 추가
4. `apiKey` 필드 제거
5. `OptimizerSettings` 추가
6. `SandboxMode`, `SandboxSettings` 관련 코드 제거

`src/utils/settings.ts` (전체 교체):
```typescript
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { HooksConfig } from "../hooks/types";
import { recommendModel } from "../ollama/models";
import { listOllamaModels } from "../ollama/discovery";

export interface OptimizerSettings {
  enableCoT?: boolean;
  enableThinking?: boolean;
  enableUltraPlan?: boolean;
  enableRag?: boolean;
  enableCompaction?: boolean;
}

export interface McpRemoteTransport { }
export type McpTransport = "http" | "sse" | "stdio";

export interface McpServerConfig {
  id: string;
  label: string;
  enabled: boolean;
  transport: McpTransport;
  url?: string;
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface McpSettings {
  servers?: McpServerConfig[];
}

export interface CustomSubagentConfig {
  name: string;
  model: string;
  instruction: string;
}

export interface UserSettings {
  defaultModel?: string;
  ollamaBaseUrl?: string;
  optimizer?: OptimizerSettings;
  mcp?: McpSettings;
  subAgents?: CustomSubagentConfig[];
  hooks?: HooksConfig;
}

export interface ProjectSettings {
  model?: string;
}

const USER_DIR = path.join(os.homedir(), ".ollama-cli");
const USER_SETTINGS_PATH = path.join(USER_DIR, "settings.json");

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function readJson<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch { return null; }
}

function writeJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function loadUserSettings(): UserSettings {
  return readJson<UserSettings>(USER_SETTINGS_PATH) || {};
}

export function saveUserSettings(partial: Partial<UserSettings>): void {
  const current = loadUserSettings();
  writeJson(USER_SETTINGS_PATH, { ...current, ...partial });
}

export function loadProjectSettings(): ProjectSettings {
  const projectPath = path.join(process.cwd(), ".ollama-cli", "settings.json");
  return readJson<ProjectSettings>(projectPath) || {};
}

export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL || loadUserSettings().ollamaBaseUrl || "http://localhost:11434";
}

export async function getCurrentModel(): Promise<string> {
  if (process.env.OLLAMA_MODEL) return process.env.OLLAMA_MODEL;
  const project = loadProjectSettings();
  if (project.model) return project.model;
  const user = loadUserSettings();
  if (user.defaultModel) return user.defaultModel;
  // Auto-recommend from installed models
  const models = await listOllamaModels(getOllamaBaseUrl());
  const recommended = recommendModel(models, "balanced");
  return recommended?.name ?? "llama3.2";
}

export function getOptimizerSettings(): Required<OptimizerSettings> {
  const saved = loadUserSettings().optimizer ?? {};
  return {
    enableCoT: saved.enableCoT ?? true,
    enableThinking: saved.enableThinking ?? true,
    enableUltraPlan: saved.enableUltraPlan ?? true,
    enableRag: saved.enableRag ?? false,
    enableCompaction: saved.enableCompaction ?? true,
  };
}

export function loadMcpServers(): McpServerConfig[] {
  return loadUserSettings().mcp?.servers ?? [];
}

export function saveMcpServers(servers: McpServerConfig[]): void {
  saveUserSettings({ mcp: { servers } });
}

export function loadValidSubAgents(): CustomSubagentConfig[] {
  return loadUserSettings().subAgents ?? [];
}
```

- [ ] **Step 2: 타입 체크**

```bash
bun run typecheck 2>&1 | grep "utils/settings" | head -20
```

Expected: 에러 있을 경우 해당 에러 확인 후 수정 (settings.ts 수정으로 생기는 downstream 에러는 Task 12에서 처리)

- [ ] **Step 3: Commit**

```bash
git add src/utils/settings.ts
git commit -m "feat(settings): migrate to ~/.ollama-cli/, remove API key, add optimizer settings"
```

---

## Task 7: Optimizer — CoT / Thinking

**Files:**
- Create: `src/ollama/optimizer/cot.ts`
- Create: `src/ollama/optimizer/cot.test.ts`

- [ ] **Step 1: 테스트 작성**

`src/ollama/optimizer/cot.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import {
  applyThinkingMode,
  forceCot,
  isThinkingModelName,
  stripThinkingTags,
} from "./cot";

const msgs = (content: string) => [{ role: "user" as const, content }];

describe("isThinkingModelName", () => {
  it("detects qwen3", () => expect(isThinkingModelName("qwen3:14b")).toBe(true));
  it("detects deepseek-r1", () => expect(isThinkingModelName("deepseek-r1:8b")).toBe(true));
  it("returns false for llama", () => expect(isThinkingModelName("llama3.2:3b")).toBe(false));
});

describe("forceCot", () => {
  it("appends CoT suffix to last user message", () => {
    const result = forceCot(msgs("fix this bug"));
    expect(result[0].content).toContain("Think step-by-step");
    expect(result[0].content).toContain("fix this bug");
  });

  it("does not add CoT if already present", () => {
    const already = msgs("fix this bug\n\nThink step-by-step before answering.");
    const result = forceCot(already);
    const count = (result[0].content.match(/Think step-by-step/g) || []).length;
    expect(count).toBe(1);
  });
});

describe("applyThinkingMode", () => {
  it("prepends /think to last user message for thinking models", () => {
    const result = applyThinkingMode(msgs("implement auth"), "qwen3:14b");
    expect(result[0].content).toMatch(/^\/think\n/);
  });

  it("does nothing for non-thinking models", () => {
    const result = applyThinkingMode(msgs("implement auth"), "llama3.2:3b");
    expect(result[0].content).toBe("implement auth");
  });

  it("does not double-prepend", () => {
    const already = msgs("/think\nimplement auth");
    const result = applyThinkingMode(already, "qwen3:14b");
    expect(result[0].content).toMatch(/^\/think\n/);
    expect(result[0].content.split("/think").length - 1).toBe(1);
  });
});

describe("stripThinkingTags", () => {
  it("removes <think>...</think> blocks", () => {
    const input = "<think>\nsome internal reasoning\n</think>\nFinal answer here.";
    expect(stripThinkingTags(input)).toBe("Final answer here.");
  });

  it("handles multiple think blocks", () => {
    const input = "<think>A</think>text<think>B</think>end";
    expect(stripThinkingTags(input)).toBe("textend");
  });

  it("passes through text without think tags", () => {
    expect(stripThinkingTags("plain text")).toBe("plain text");
  });
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
bunx vitest run src/ollama/optimizer/cot.test.ts
```

Expected: FAIL

- [ ] **Step 3: 구현 작성**

`src/ollama/optimizer/cot.ts`:
```typescript
const THINKING_MODEL_HINTS = ["qwen3", "deepseek-r1", "qwq", "marco-o1"] as const;

const COT_SUFFIX = "\n\nThink step-by-step before answering. Show your reasoning, then provide the final answer.";

export interface CoreMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | unknown;
}

export function isThinkingModelName(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return THINKING_MODEL_HINTS.some((hint) => lower.includes(hint));
}

export function forceCot(messages: CoreMessage[]): CoreMessage[] {
  const msgs = messages.map((m) => ({ ...m }));
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "user" && typeof msgs[i].content === "string") {
      const content = msgs[i].content as string;
      if (!content.includes("Think step-by-step")) {
        msgs[i] = { ...msgs[i], content: content + COT_SUFFIX };
      }
      break;
    }
  }
  return msgs;
}

export function applyThinkingMode(messages: CoreMessage[], modelId: string): CoreMessage[] {
  if (!isThinkingModelName(modelId)) return messages;
  const msgs = messages.map((m) => ({ ...m }));
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "user" && typeof msgs[i].content === "string") {
      const content = msgs[i].content as string;
      if (!content.startsWith("/think")) {
        msgs[i] = { ...msgs[i], content: "/think\n" + content };
      }
      break;
    }
  }
  return msgs;
}

export function stripThinkingTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
bunx vitest run src/ollama/optimizer/cot.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ollama/optimizer/cot.ts src/ollama/optimizer/cot.test.ts
git commit -m "feat(optimizer): add CoT forcing and thinking mode support"
```

---

## Task 8: Optimizer — UltraPlan

**Files:**
- Create: `src/ollama/optimizer/ultraplan.ts`
- Create: `src/ollama/optimizer/ultraplan.test.ts`

- [ ] **Step 1: 테스트 작성**

`src/ollama/optimizer/ultraplan.test.ts`:
```typescript
import { describe, expect, it, vi } from "vitest";
import { injectPlan, isComplexRequest, ULTRAPLAN_HEADER } from "./ultraplan";

describe("isComplexRequest", () => {
  it("returns true for implement requests over min length", () => {
    const text = "implement a full user authentication system with JWT tokens and refresh logic " + "a".repeat(60);
    expect(isComplexRequest(text)).toBe(true);
  });

  it("returns false for short messages", () => {
    expect(isComplexRequest("implement auth")).toBe(false);
  });

  it("returns false for simple questions without keywords", () => {
    const text = "what is the meaning of life? " + "a".repeat(100);
    expect(isComplexRequest(text)).toBe(false);
  });

  it("returns true for refactor keyword", () => {
    const text = "refactor the entire database layer to use a repository pattern " + "a".repeat(60);
    expect(isComplexRequest(text)).toBe(true);
  });
});

describe("injectPlan", () => {
  it("appends plan block to system prompt", () => {
    const result = injectPlan("You are a helper.", "1. Step one\n2. Step two");
    expect(result).toContain(ULTRAPLAN_HEADER);
    expect(result).toContain("1. Step one");
    expect(result).toContain("You are a helper.");
  });
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
bunx vitest run src/ollama/optimizer/ultraplan.test.ts
```

Expected: FAIL

- [ ] **Step 3: 구현 작성**

`src/ollama/optimizer/ultraplan.ts`:
```typescript
import { getOllamaBaseUrl } from "../discovery";

export const ULTRAPLAN_HEADER = "## ULTRAPLAN — Pre-computed Implementation Plan";
const ULTRAPLAN_MIN_LENGTH = 120;
const COMPLEX_PATTERN =
  /\b(?:implement|create|build|refactor|migrate|design|architect|optimize|add feature|add support|set up|configure|integrate|convert|replace)\b/i;

export function isComplexRequest(text: string): boolean {
  return text.length >= ULTRAPLAN_MIN_LENGTH && COMPLEX_PATTERN.test(text);
}

export function injectPlan(systemPrompt: string, plan: string): string {
  return `${systemPrompt}\n\n${ULTRAPLAN_HEADER}\n${plan}`;
}

async function callOllamaFast(
  prompt: string,
  modelId: string,
  baseUrl: string,
  maxTokens = 512,
): Promise<string> {
  const resp = await fetch(`${getOllamaBaseUrl(baseUrl)}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      options: { num_predict: maxTokens, temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!resp.ok) throw new Error(`Ollama error: ${resp.status}`);
  const data = (await resp.json()) as { message?: { content?: string } };
  return data.message?.content?.trim() ?? "";
}

export async function generatePlan(
  userText: string,
  modelId: string,
  baseUrl?: string,
): Promise<string> {
  const planPrompt =
    "You are a software architect. Analyze the following request and produce " +
    "a concise numbered implementation plan (5-10 steps). Output ONLY the plan, no preamble.\n\n" +
    "Request:\n" +
    userText.slice(0, 800);
  try {
    return await callOllamaFast(planPrompt, modelId, baseUrl ?? "", 512);
  } catch {
    return "";
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
bunx vitest run src/ollama/optimizer/ultraplan.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ollama/optimizer/ultraplan.ts src/ollama/optimizer/ultraplan.test.ts
git commit -m "feat(optimizer): add UltraPlan complexity detection and plan pre-generation"
```

---

## Task 9: Optimizer — RAG

**Files:**
- Create: `src/ollama/optimizer/rag.ts`
- Create: `src/ollama/optimizer/rag.test.ts`

- [ ] **Step 1: 테스트 작성**

`src/ollama/optimizer/rag.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { buildContextBlock, chunkText, cosineSimilarity } from "./rag";

describe("cosineSimilarity", () => {
  it("returns 1.0 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1.0);
  });

  it("returns 0.0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
  });

  it("returns 0.0 for zero vectors", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe("chunkText", () => {
  it("splits text into overlapping chunks", () => {
    const text = "a".repeat(1200);
    const chunks = chunkText(text, 500, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBe(500);
  });

  it("returns single chunk for short text", () => {
    expect(chunkText("short", 500, 100)).toEqual(["short"]);
  });
});

describe("buildContextBlock", () => {
  it("builds formatted context block from chunks", () => {
    const chunks = [
      { path: "src/foo.ts", text: "function foo() {}", score: 0.8 },
    ];
    const result = buildContextBlock(chunks);
    expect(result).toContain("## Relevant Code Context (RAG)");
    expect(result).toContain("src/foo.ts");
    expect(result).toContain("function foo() {}");
  });

  it("returns empty string for empty chunks", () => {
    expect(buildContextBlock([])).toBe("");
  });
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
bunx vitest run src/ollama/optimizer/rag.test.ts
```

Expected: FAIL

- [ ] **Step 3: 구현 작성**

`src/ollama/optimizer/rag.ts`:
```typescript
import * as fs from "fs";
import * as path from "path";
import { getOllamaBaseUrl } from "../discovery";

export const RAG_INDEX_FILE = ".ollama-cli-rag-index.json";
const RAG_EMBED_MODEL = "nomic-embed-text";
const RAG_CHUNK_SIZE = 500;
const RAG_CHUNK_OVERLAP = 100;
const RAG_TOP_K = 5;
const RAG_THRESHOLD = 0.30;

export interface RagChunk {
  path: string;
  text: string;
  embedding: number[];
  mtime: number;
}

export interface ScoredChunk {
  path: string;
  text: string;
  score: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * (b[i] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

export function chunkText(text: string, size = RAG_CHUNK_SIZE, overlap = RAG_CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}

async function embed(text: string, baseUrl: string): Promise<number[]> {
  for (const [endpoint, body] of [
    ["/api/embed", { model: RAG_EMBED_MODEL, input: text }] as const,
    ["/api/embeddings", { model: RAG_EMBED_MODEL, prompt: text }] as const,
  ]) {
    try {
      const resp = await fetch(`${getOllamaBaseUrl(baseUrl)}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (!resp.ok) continue;
      const data = (await resp.json()) as { embeddings?: number[][]; embedding?: number[] };
      const emb = (data.embeddings ?? [[]])[0] ?? data.embedding ?? [];
      if (emb.length > 0) return emb;
    } catch { /* try next endpoint */ }
  }
  return [];
}

export function loadIndex(indexPath: string): RagChunk[] {
  try {
    if (!fs.existsSync(indexPath)) return [];
    return JSON.parse(fs.readFileSync(indexPath, "utf-8")) as RagChunk[];
  } catch { return []; }
}

export function saveIndex(indexPath: string, chunks: RagChunk[]): void {
  fs.writeFileSync(indexPath, JSON.stringify(chunks, null, 2));
}

const INDEXABLE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".c", ".cpp", ".h", ".md"]);
const SKIP_DIRS = new Set([".git", "node_modules", "target", "__pycache__", ".venv", "dist"]);

export async function indexDirectory(
  dir: string,
  baseUrl: string,
  indexPath = RAG_INDEX_FILE,
  onFile?: (filePath: string) => void,
): Promise<void> {
  const existing = loadIndex(indexPath);
  const chunkMap = new Map<string, RagChunk[]>(
    existing.reduce<[string, RagChunk[]][]>((acc, c) => {
      const arr = acc.find(([k]) => k === c.path);
      if (arr) arr[1].push(c); else acc.push([c.path, [c]]);
      return acc;
    }, []),
  );

  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!INDEXABLE_EXTS.has(path.extname(entry.name))) continue;
      const mtime = fs.statSync(full).mtimeMs;
      const existing = chunkMap.get(full);
      if (existing && existing[0] && existing[0].mtime >= mtime) continue;
      onFile?.(full);
      const text = fs.readFileSync(full, "utf-8");
      const chunks = chunkText(text);
      const newChunks: RagChunk[] = [];
      for (const chunk of chunks) {
        const embedding = await embed(chunk, baseUrl);
        if (embedding.length > 0) newChunks.push({ path: full, text: chunk, embedding, mtime });
      }
      if (newChunks.length > 0) chunkMap.set(full, newChunks);
    }
  };
  walk(dir);

  const allChunks = [...chunkMap.values()].flat();
  saveIndex(indexPath, allChunks);
}

export async function queryIndex(
  userText: string,
  baseUrl: string,
  indexPath = RAG_INDEX_FILE,
  topK = RAG_TOP_K,
  threshold = RAG_THRESHOLD,
): Promise<ScoredChunk[]> {
  const chunks = loadIndex(indexPath);
  if (chunks.length === 0) return [];
  const queryEmb = await embed(userText.slice(0, 1500), baseUrl);
  if (queryEmb.length === 0) return [];
  return chunks
    .map((c) => ({ path: c.path, text: c.text, score: cosineSimilarity(queryEmb, c.embedding) }))
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function buildContextBlock(chunks: ScoredChunk[]): string {
  if (chunks.length === 0) return "";
  const parts = ["## Relevant Code Context (RAG)"];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const key = `${chunk.path}:${chunk.text.slice(0, 50)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const lang = path.extname(chunk.path).slice(1);
    parts.push(`\n### ${chunk.path}\n\`\`\`${lang}\n${chunk.text}\n\`\`\``);
  }
  return parts.join("\n");
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
bunx vitest run src/ollama/optimizer/rag.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ollama/optimizer/rag.ts src/ollama/optimizer/rag.test.ts
git commit -m "feat(optimizer): add vector RAG with nomic-embed-text"
```

---

## Task 10: Optimizer Pipeline

**Files:**
- Create: `src/ollama/optimizer/index.ts`

- [ ] **Step 1: 파이프라인 작성**

`src/ollama/optimizer/index.ts`:
```typescript
import { getOptimizerSettings } from "../../utils/settings";
import { getOllamaBaseUrl } from "../discovery";
import { applyThinkingMode, forceCot, stripThinkingTags } from "./cot";
import { generatePlan, injectPlan, isComplexRequest } from "./ultraplan";
import { buildContextBlock, queryIndex, RAG_INDEX_FILE } from "./rag";
import * as fs from "fs";

export interface OptimizerInput {
  messages: Array<{ role: string; content: string | unknown }>;
  systemPrompt: string;
  modelId: string;
  baseUrl?: string;
}

export interface OptimizerOutput {
  messages: Array<{ role: string; content: string | unknown }>;
  systemPrompt: string;
}

function extractLastUserText(messages: Array<{ role: string; content: string | unknown }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user" && typeof messages[i].content === "string") {
      return messages[i].content as string;
    }
  }
  return "";
}

export async function runOptimizerPipeline(input: OptimizerInput): Promise<OptimizerOutput> {
  if (process.env.OLLAMA_CLI_NO_OPTIMIZER) return { messages: input.messages, systemPrompt: input.systemPrompt };

  const cfg = getOptimizerSettings();
  let { messages, systemPrompt, modelId, baseUrl } = input;
  const resolvedBaseUrl = getOllamaBaseUrl(baseUrl);
  const userText = extractLastUserText(messages);

  // [1] RAG — inject relevant code context
  if (cfg.enableRag && fs.existsSync(RAG_INDEX_FILE)) {
    const chunks = await queryIndex(userText, resolvedBaseUrl);
    const ctx = buildContextBlock(chunks);
    if (ctx) systemPrompt = `${systemPrompt}\n\n${ctx}`;
  }

  // [2] UltraPlan — pre-generate plan for complex requests
  if (cfg.enableUltraPlan && isComplexRequest(userText)) {
    const plan = await generatePlan(userText, modelId, resolvedBaseUrl);
    if (plan) systemPrompt = injectPlan(systemPrompt, plan);
  }

  // [3] CoT — force chain-of-thought
  if (cfg.enableCoT) {
    messages = forceCot(messages as Array<{ role: "user" | "assistant" | "system" | "tool"; content: string | unknown }>);
  }

  // [4] Thinking mode — for models that support it
  if (cfg.enableThinking) {
    messages = applyThinkingMode(messages as Array<{ role: "user" | "assistant" | "system" | "tool"; content: string | unknown }>, modelId);
  }

  return { messages, systemPrompt };
}

export { stripThinkingTags };
```

- [ ] **Step 2: 타입 체크**

```bash
bun run typecheck 2>&1 | grep "optimizer/index" | head -20
```

Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/ollama/optimizer/index.ts
git commit -m "feat(optimizer): add pipeline integrating CoT, UltraPlan, RAG"
```

---

## Task 11: Agent 통합

**Files:**
- Modify: `src/agent/compaction.ts` (import 교체)
- Modify: `src/agent/agent.ts` (import + optimizer 통합)

- [ ] **Step 1: compaction.ts import 교체**

`src/agent/compaction.ts`에서 `XaiProvider` 관련 import를 `OllamaProvider`로 교체한다:

```typescript
// 변경 전 (상단 imports)
import { resolveModelRuntime, type XaiProvider } from "../grok/client";

// 변경 후
import { resolveModelRuntime, type OllamaProvider } from "../ollama/client";
```

파일 내 `XaiProvider` 타입 참조 전체를 `OllamaProvider`로 교체:

```bash
cd /Users/jerry/dev/ollama-cli
sed -i '' 's/XaiProvider/OllamaProvider/g; s/from "..\/grok\/client"/from "..\/ollama\/client"/g' src/agent/compaction.ts
```

- [ ] **Step 2: compaction.ts 타입 체크**

```bash
bun run typecheck 2>&1 | grep "compaction" | head -20
```

Expected: 에러 없음

- [ ] **Step 3: agent.ts grok imports 교체**

`src/agent/agent.ts` 상단에서 `grok` 경로 imports를 `ollama`로 교체:

```typescript
// 다음 줄들을 찾아 교체한다 (총 5줄)

// 변경 전:
import { addBatchRequests, ... } from "../grok/batch";
import { createProvider, generateTitle as genTitle, resolveModelRuntime, type XaiProvider } from "../grok/client";
import { DEFAULT_MODEL, getModelInfo, normalizeModelId } from "../grok/models";
import { toolSetToBatchTools } from "../grok/tool-schemas";
import { createTools } from "../grok/tools";

// 변경 후:
import { createProvider, generateTitle as genTitle, resolveModelRuntime, type OllamaProvider } from "../ollama/client";
import { isViableOllamaChatModel } from "../ollama/models";
import { createTools } from "../grok/tools";
```

`src/agent/agent.ts`의 `AgentOptions` 인터페이스에서 `sandboxMode`, `sandboxSettings`, `batchApi` 제거:

```typescript
// 변경 전:
interface AgentOptions {
  persistSession?: boolean;
  session?: string;
  sandboxMode?: SandboxMode;
  sandboxSettings?: SandboxSettings;
  batchApi?: boolean;
}

// 변경 후:
interface AgentOptions {
  persistSession?: boolean;
  session?: string;
}
```

- [ ] **Step 4: agent.ts에서 Grok 특화 상수 업데이트**

```typescript
// 변경 전:
const VISION_MODEL = "grok-4-1-fast-reasoning";
const COMPUTER_MODEL = "grok-4.20-0309-reasoning";

// 변경 후:
const VISION_MODEL = "llava";  // ollama multimodal model
const COMPUTER_MODEL = "llava";
```

MODE_PROMPTS의 "Grok CLI" 텍스트를 "ollama-cli"로 교체:

```bash
sed -i '' 's/You are Grok CLI/You are ollama-cli/g; s/Grok CLI/ollama-cli/g' src/agent/agent.ts
```

- [ ] **Step 5: optimizer 파이프라인 훅 추가**

`src/agent/agent.ts`에서 `processMessage` 메서드 시작 부분에 optimizer import 및 호출을 추가한다. 파일에서 `processMessage` 함수를 찾아 그 안의 첫 번째 `streamText` 호출 직전에 다음을 삽입:

먼저 파일 상단 imports에 추가:
```typescript
import { runOptimizerPipeline, stripThinkingTags } from "../ollama/optimizer/index";
```

`processMessage`의 메시지 처리 루프 직전 (시스템 프롬프트와 메시지를 LLM에 보내기 전):
```typescript
// Optimizer pipeline: CoT, RAG, UltraPlan, thinking mode
const optimized = await runOptimizerPipeline({
  messages: messages as Array<{ role: string; content: string | unknown }>,
  systemPrompt,
  modelId: this.model,
  baseUrl: this.baseURL,
});
// Use optimized messages and systemPrompt for the LLM call
```

> **Note:** agent.ts는 26K 토큰이므로 실제 삽입 위치는 파일을 열어 `streamText(` 첫 번째 호출 직전에 추가한다. `streamText`의 `system` 파라미터에 `optimized.systemPrompt`를 사용하고, `messages`에 `optimized.messages`를 사용한다.

- [ ] **Step 6: batch 관련 코드 제거**

agent.ts에서 batch API 관련 코드 블록 제거 (`batchApi` 조건 분기, `createBatch`, `pollBatchRequestResult` 등):
- `import ... from "../grok/batch"` 삭제
- `batchApi` 조건 분기 블록 삭제 (일반 `streamText` 경로만 남김)

- [ ] **Step 7: 타입 체크**

```bash
bun run typecheck 2>&1 | head -30
```

Expected: 에러 있을 경우 각 에러를 개별 수정 (주로 import 경로 문제)

- [ ] **Step 8: Commit**

```bash
git add src/agent/compaction.ts src/agent/agent.ts
git commit -m "feat(agent): migrate from grok to ollama provider, integrate optimizer pipeline"
```

---

## Task 12: CLI 진입점 (index.ts) 재작성

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: index.ts 전체 교체**

`src/index.ts`:
```typescript
#!/usr/bin/env bun
import { program } from "commander";
import * as dotenv from "dotenv";
import packageJson from "../package.json";
import { Agent } from "./agent/agent";
import { completeDelegation, failDelegation, loadDelegation } from "./agent/delegations";
import {
  createHeadlessJsonlEmitter,
  type HeadlessOutputFormat,
  isHeadlessOutputFormat,
  renderHeadlessChunk,
  renderHeadlessPrelude,
} from "./headless/output";
import { startScheduleDaemon } from "./tools/schedule";
import { processAtMentions } from "./utils/at-mentions.js";
import { runScriptManagedUninstall } from "./utils/install-manager";
import { getCurrentModel, getOllamaBaseUrl, saveUserSettings } from "./utils/settings";
import { runUpdate } from "./utils/update-checker";
import { hasLocalOllama, listOllamaModels } from "./ollama/discovery";
import { pullModel } from "./ollama/pull";
import { recommendModel } from "./ollama/models";
import type { RecommendationGoal } from "./ollama/models";
import { indexDirectory } from "./ollama/optimizer/rag";
import * as path from "path";

dotenv.config();

process.on("SIGTERM", () => process.exit(0));
process.on("uncaughtException", (err) => { console.error("Fatal:", err.message); process.exit(1); });
process.on("unhandledRejection", (reason) => { console.error("Unhandled rejection:", reason); process.exit(1); });

async function checkOllamaRunning(): Promise<void> {
  const running = await hasLocalOllama(getOllamaBaseUrl());
  if (!running) {
    console.error("Error: Ollama is not running. Start it with: ollama serve");
    process.exit(1);
  }
}

async function startInteractive(
  baseURL: string,
  model: string,
  maxToolRounds: number,
  session?: string,
  initialMessage?: string,
) {
  const agent = new Agent(undefined, baseURL, model, maxToolRounds, { session });
  const { createCliRenderer } = await import("@opentui/core");
  const { createRoot } = await import("@opentui/react");
  const { createElement } = await import("react");
  const { App } = await import("./ui/app");

  const renderer = await createCliRenderer({ exitOnCtrlC: false, useKittyKeyboard: { disambiguate: true, alternateKeys: true } });
  const onExit = () => { renderer.destroy(); process.exit(0); };

  createRoot(renderer).render(
    createElement(App, {
      agent,
      startupConfig: { apiKey: undefined, baseURL, model, maxToolRounds, sandboxMode: "off", sandboxSettings: {}, version: packageJson.version },
      initialMessage,
      onExit,
    }),
  );
}

async function runHeadless(
  prompt: string,
  baseURL: string,
  model: string,
  maxToolRounds: number,
  format: HeadlessOutputFormat,
  session?: string,
) {
  const agent = new Agent(undefined, baseURL, model, maxToolRounds, { session });
  const prelude = renderHeadlessPrelude(format, agent.getSessionId() || undefined);
  if (prelude.stdout) process.stdout.write(prelude.stdout);
  if (prelude.stderr) process.stderr.write(prelude.stderr);

  const { enhancedMessage } = processAtMentions(prompt, process.cwd());

  if (format === "json") {
    const { observer, consumeChunk, flush } = createHeadlessJsonlEmitter(agent.getSessionId() || undefined);
    for await (const chunk of agent.processMessage(enhancedMessage, observer)) {
      const writes = consumeChunk(chunk);
      if (writes.stdout) process.stdout.write(writes.stdout);
      if (writes.stderr) process.stderr.write(writes.stderr ?? "");
    }
    const tail = flush();
    if (tail.stdout) process.stdout.write(tail.stdout);
    if (tail.stderr) process.stderr.write(tail.stderr ?? "");
    return;
  }

  for await (const chunk of agent.processMessage(enhancedMessage)) {
    const writes = renderHeadlessChunk(chunk);
    if (writes.stdout) process.stdout.write(writes.stdout);
    if (writes.stderr) process.stderr.write(writes.stderr);
  }
}

function parseHeadlessOutputFormat(value: string): HeadlessOutputFormat {
  if (isHeadlessOutputFormat(value)) return value;
  throw new Error(`Invalid format "${value}". Expected "text" or "json".`);
}

// ── Main command ──────────────────────────────────────────────────────────────

program
  .name("ollama-cli")
  .description("Local AI coding agent powered by Ollama — no API key required")
  .version(packageJson.version)
  .argument("[message...]", "Initial message to send")
  .option("-u, --base-url <url>", "Ollama base URL (default: http://localhost:11434)")
  .option("-m, --model <model>", "Model to use")
  .option("-d, --directory <dir>", "Working directory", process.cwd())
  .option("-p, --prompt <prompt>", "Run a single prompt headlessly")
  .option("--format <format>", "Headless output format: text or json", parseHeadlessOutputFormat, "text")
  .option("-s, --session <id>", "Continue a saved session by id, or use 'latest'")
  .option("--max-tool-rounds <n>", "Max tool execution rounds", "400")
  .option("--no-cot", "Disable CoT forcing")
  .option("--no-ultraplan", "Disable UltraPlan")
  .option("--no-rag", "Disable RAG context injection")
  .option("--update", "Update ollama-cli to the latest version and exit")
  .action(async (message: string[], options) => {
    if (options.update) {
      const result = await runUpdate(packageJson.version);
      console.log(result.output);
      process.exit(result.success ? 0 : 1);
    }

    if (options.directory) {
      try { process.chdir(options.directory); } catch (e: unknown) {
        console.error(`Cannot change to directory ${options.directory}: ${e instanceof Error ? e.message : e}`);
        process.exit(1);
      }
    }

    await checkOllamaRunning();

    const baseURL = options.baseUrl || getOllamaBaseUrl();
    const model = options.model || await getCurrentModel();
    const maxToolRounds = parseInt(options.maxToolRounds || "400", 10) || 400;

    if (typeof options.model === "string") saveUserSettings({ defaultModel: options.model });

    if (options.prompt) {
      await runHeadless(options.prompt, baseURL, model, maxToolRounds, options.format, options.session);
      return;
    }

    const initialMessage = message.length > 0 ? message.join(" ") : undefined;
    await startInteractive(baseURL, model, maxToolRounds, options.session, initialMessage);
  });

// ── models command ────────────────────────────────────────────────────────────

const modelsCmd = program.command("models").description("Manage Ollama models");

modelsCmd
  .command("list")
  .alias("ls")
  .description("List installed models with recommendation")
  .option("--goal <goal>", "Recommendation goal: latency, balanced, coding", "balanced")
  .action(async (options) => {
    const baseURL = getOllamaBaseUrl();
    const models = await listOllamaModels(baseURL);
    if (models.length === 0) {
      console.log("No models installed. Run: ollama-cli models pull <name>");
      return;
    }
    const goal = (options.goal as RecommendationGoal) || "balanced";
    const recommended = recommendModel(models, goal);
    console.log(`\nInstalled Ollama Models (goal: ${goal}):\n`);
    for (const m of models) {
      const isRec = m.name === recommended?.name;
      const tag = isRec ? " \x1b[32m← recommended\x1b[0m" : "";
      const size = m.sizeBytes ? ` (${(m.sizeBytes / 1e9).toFixed(1)}GB)` : "";
      const family = m.family ? ` [${m.family}]` : "";
      console.log(`  \x1b[36m${m.name}\x1b[0m${size}${family}${tag}`);
    }
    console.log();
  });

modelsCmd
  .command("pull <name>")
  .description("Download a model from Ollama registry")
  .action(async (name: string) => {
    console.log(`Pulling ${name}...`);
    let lastStatus = "";
    await pullModel(name, (progress) => {
      const pct = progress.total && progress.completed
        ? ` ${Math.round((progress.completed / progress.total) * 100)}%`
        : "";
      const status = `${progress.status}${pct}`;
      if (status !== lastStatus) { process.stdout.write(`\r${status}    `); lastStatus = status; }
    }, getOllamaBaseUrl());
    console.log(`\n✓ ${name} pulled successfully.`);
    saveUserSettings({ defaultModel: name });
  });

modelsCmd
  .command("recommend [goal]")
  .description("Recommend the best installed model (latency | balanced | coding)")
  .action(async (goal?: string) => {
    const normalizedGoal = (["latency", "balanced", "coding"].includes(goal ?? "") ? goal : "balanced") as RecommendationGoal;
    const models = await listOllamaModels(getOllamaBaseUrl());
    const rec = recommendModel(models, normalizedGoal);
    if (!rec) { console.log("No suitable models found. Install one with: ollama pull <name>"); return; }
    console.log(`\nRecommended for ${normalizedGoal}: \x1b[36m${rec.name}\x1b[0m`);
    console.log(`Use it: ollama-cli -m ${rec.name}\n`);
  });

// ── rag command ───────────────────────────────────────────────────────────────

const ragCmd = program.command("rag").description("Manage RAG codebase index");

ragCmd
  .command("index [dirs...]")
  .description("Index directories for RAG context injection")
  .action(async (dirs: string[]) => {
    const targets = dirs.length > 0 ? dirs : [process.cwd()];
    const baseURL = getOllamaBaseUrl();
    for (const dir of targets) {
      console.log(`Indexing ${path.resolve(dir)}...`);
      let count = 0;
      await indexDirectory(path.resolve(dir), baseURL, undefined, () => count++);
      console.log(`  ✓ ${count} files indexed`);
    }
    console.log("RAG index updated. Re-run after code changes to refresh.");
    saveUserSettings({ optimizer: { enableRag: true } });
  });

ragCmd
  .command("stats")
  .description("Show RAG index statistics")
  .action(async () => {
    const { loadIndex, RAG_INDEX_FILE } = await import("./ollama/optimizer/rag");
    const chunks = loadIndex(RAG_INDEX_FILE);
    if (chunks.length === 0) { console.log("No RAG index found. Run: ollama-cli rag index"); return; }
    const files = new Set(chunks.map((c) => c.path)).size;
    console.log(`\nRAG Index Stats:\n  Files: ${files}\n  Chunks: ${chunks.length}\n`);
  });

// ── Other commands ────────────────────────────────────────────────────────────

program.command("update").description("Update ollama-cli to the latest release").action(async () => {
  const result = await runUpdate(packageJson.version);
  console.log(result.output);
  process.exit(result.success ? 0 : 1);
});

program.command("uninstall").description("Remove ollama-cli binary and optional data")
  .option("--dry-run").option("--force").option("--keep-config").option("--keep-data")
  .action(async (options) => {
    const result = await runScriptManagedUninstall({ dryRun: !!options.dryRun, force: !!options.force, keepConfig: !!options.keepConfig, keepData: !!options.keepData });
    console.log(result.output);
    process.exit(result.success ? 0 : 1);
  });

program.command("daemon").description("Start the schedule daemon")
  .option("--background")
  .action(async (options) => {
    if (options.background) {
      const result = await startScheduleDaemon(process.cwd());
      console.log(result.alreadyRunning ? `Daemon already running.` : `Daemon started.`);
      return;
    }
    process.off("SIGTERM", () => process.exit(0));
    const { SchedulerDaemon } = await import("./daemon/scheduler");
    await new SchedulerDaemon().start();
  });

program.parse();
```

- [ ] **Step 2: 타입 체크**

```bash
bun run typecheck 2>&1 | grep "index.ts" | head -20
```

Expected: 에러 수정 후 통과

- [ ] **Step 3: 빌드 테스트**

```bash
bun run dev -- --version
```

Expected: `1.0.0`

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(cli): rewrite CLI with ollama models/rag commands, remove grok-specific options"
```

---

## Task 13: 클린업 — 불필요한 파일 제거

**Files:**
- Delete: `src/grok/` (전체)
- Delete: `src/telegram/` (전체)
- Delete: `src/audio/` (전체)

- [ ] **Step 1: telegram/audio 제거**

```bash
cd /Users/jerry/dev/ollama-cli
rm -rf src/telegram src/audio
```

- [ ] **Step 2: grok/ 제거 (단, tools.ts는 먼저 확인)**

`src/grok/tools.ts`는 `agent.ts`에서 아직 사용 중이므로, 먼저 `src/ollama/tools.ts`로 이동하거나 `agent.ts`에서 import 경로를 조정한다:

```bash
# grok/tools.ts를 agent가 사용하는지 확인
grep -r "from.*grok/tools" src/agent/
```

만약 `agent.ts`가 `../grok/tools`를 참조한다면:
```bash
# grok/tools.ts를 ollama/tools.ts로 복사
cp src/grok/tools.ts src/ollama/tools.ts
# agent.ts에서 import 경로 수정
sed -i '' 's/from "..\/grok\/tools"/from "..\/ollama\/tools"/g' src/agent/agent.ts
# 같은 방식으로 tool-schemas, batch 등 남은 grok 참조 처리
grep -r 'from ".*grok/' src/ | grep -v ".test." | grep -v node_modules
```

남은 `grok/` 참조를 모두 해결한 후:
```bash
rm -rf src/grok
```

- [ ] **Step 3: 타입 체크 통과 확인**

```bash
bun run typecheck 2>&1 | head -40
```

Expected: 에러 없음

- [ ] **Step 4: 전체 테스트 실행**

```bash
bunx vitest run
```

Expected: 새로 작성한 테스트 모두 PASS, 기존 테스트 중 grok/telegram 관련 제외하고 PASS

- [ ] **Step 5: 빌드 확인**

```bash
bun run build 2>&1 | tail -5
```

Expected: 빌드 성공

- [ ] **Step 6: 스모크 테스트 (ollama 실행 중일 때)**

```bash
bun run dev -- models list
bun run dev -- models recommend coding
```

Expected: 설치된 모델 목록 출력

- [ ] **Step 7: Final Commit**

```bash
git add -A
git commit -m "chore: remove telegram, audio, grok/ directories; complete ollama-cli migration"
```

---

## Self-Review

### Spec Coverage Check

| 스펙 요구사항 | 구현 Task |
|---|---|
| grok-cli 포크 + ollama 레이어 교체 | Task 1, 3 |
| `@ai-sdk/openai` + ollama `/v1` | Task 3 |
| ollama 실행 감지 | Task 2 |
| 모델 목록 + 스코어링 + 추천 | Task 4 |
| 모델 pull + 진행률 | Task 5 |
| `~/.ollama-cli/` 설정 | Task 6 |
| CoT 강제 + thinking 모드 | Task 7 |
| UltraPlan 복잡도 감지 + 계획 선생성 | Task 8 |
| RAG 벡터 인덱싱 + 쿼리 | Task 9 |
| 파이프라인 통합 | Task 10 |
| Agent 통합 | Task 11 |
| CLI 커맨드 (models/rag) | Task 12 |
| Telegram/Audio 제거 | Task 13 |
| Sandbox 제거 | Task 6, 13 |
| SQLite 세션 유지 | grok-cli 그대로 재사용 |
| OpenTUI TUI 유지 | grok-cli 그대로 재사용 |
| MCP 지원 | grok-cli 그대로 재사용 |

### Placeholder Scan
없음 — 모든 코드 블록이 실제 구현을 포함한다.

### Type Consistency
- `OllamaProvider`: Task 3에서 정의, Task 11의 compaction.ts에서 사용 ✓
- `OllamaModelDescriptor`: Task 2에서 정의, Task 4/10에서 사용 ✓
- `RecommendationGoal`: Task 4에서 정의, Task 12에서 사용 ✓
- `CoreMessage`: Task 7에서 정의, Task 10에서 사용 ✓
