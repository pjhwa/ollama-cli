# ollama-cli Design Spec

**Date:** 2026-04-06  
**Status:** Approved

---

## Overview

`ollama-cli`는 로컬 Ollama 모델을 위한 풀-에이전트 코딩 CLI다. API 키가 불필요하며, 로컬 모델의 코딩 성능을 극대화하는 최적화 레이어를 내장한다.

**소스:** grok-cli 포크 베이스 + openclaude의 provider 로직 + ollama-code 브릿지의 코딩 성능 향상 로직을 TypeScript로 통합.

---

## Architecture

### 디렉터리 구조

```
ollama-cli/
├── src/
│   ├── index.ts                  # CLI 진입점 (commander)
│   ├── ollama/                   # grok/grok/* 대체 레이어
│   │   ├── client.ts             # createOpenAI() 기반 provider 생성
│   │   ├── models.ts             # 설치된 모델 목록, 스코어링, 추천
│   │   ├── discovery.ts          # ollama 실행 감지 (/api/tags 폴링)
│   │   ├── pull.ts               # 모델 다운로드 스트리밍 래퍼
│   │   └── optimizer/            # 코딩 성능 향상 파이프라인
│   │       ├── cot.ts            # CoT 강제 + thinking 모드
│   │       ├── ultraplan.ts      # 복잡도 감지 + 계획 선생성
│   │       ├── compactor.ts      # 컨텍스트 자동 압축
│   │       ├── rag.ts            # 코드베이스 벡터 RAG
│   │       └── index.ts          # 파이프라인 통합
│   ├── agent/                    # grok-cli 재사용 (agent.ts, delegations, compaction)
│   ├── tools/                    # grok-cli 재사용 (bash, file, computer)
│   ├── storage/                  # grok-cli 재사용 (SQLite 세션, transcript)
│   ├── ui/                       # grok-cli 재사용 (OpenTUI + React)
│   ├── mcp/                      # grok-cli 재사용
│   ├── hooks/                    # grok-cli 재사용
│   ├── headless/                 # grok-cli 재사용
│   └── utils/
│       ├── settings.ts           # ~/.ollama-cli/ 경로, apiKey 제거
│       └── ...                   # 나머지 grok-cli utils 재사용
```

### 핵심 변경 (grok-cli 대비)

| 항목 | grok-cli | ollama-cli |
|---|---|---|
| AI SDK provider | `@ai-sdk/xai` | `@ai-sdk/openai` |
| API 키 | 필수 (`GROK_API_KEY`) | 불필요 (더미 `'ollama'`) |
| 기본 URL | `https://api.x.ai/v1` | `http://localhost:11434/v1` |
| 설정 경로 | `~/.grok/` | `~/.ollama-cli/` |
| 바이너리명 | `grok` | `ollama-cli` |
| Telegram | 포함 | 제거 |
| Sandbox (Shuru) | 포함 | 제거 |
| 모델 관리 | 없음 | 내장 (list/pull/recommend) |
| 코딩 최적화 | 없음 | optimizer 파이프라인 내장 |

---

## Components

### 1. Ollama Provider Layer (`src/ollama/`)

#### `discovery.ts`
- `hasLocalOllama(baseUrl?)`: `GET /api/tags` 1.2초 타임아웃으로 ollama 실행 여부 확인
- `listOllamaModels(baseUrl?)`: 설치된 모델 목록 반환 (`OllamaModelDescriptor[]`)
- `getOllamaBaseUrl()`: `OLLAMA_BASE_URL` 환경변수 → 기본값 `http://localhost:11434`
- 출처: openclaude `providerDiscovery.ts`

#### `client.ts`
- `createProvider(baseUrl?)`: `@ai-sdk/openai`의 `createOpenAI({ baseURL: '...', apiKey: 'ollama' })`
- `resolveModelRuntime(provider, modelId)`: 단순화된 모델 런타임 (xAI 특화 로직 제거)
- ollama는 OpenAI 호환 `/v1` 엔드포인트 제공 → API 키 자리에 더미값 `'ollama'` 사용

#### `models.ts`
- `OllamaModelDescriptor`: `{ name, sizeBytes, family, parameterSize, quantizationLevel }`
- `recommendModel(models, goal)`: `latency` / `balanced` / `coding` 목표별 스코어링
  - 코딩 힌트 우선: `qwen2.5-coder`, `deepseek-coder`, `codellama`, `starcoder`
  - 크기 기반 점수: latency → 소형(≤4B) 선호, coding → 중대형(7B+) 선호
- `isViableOllamaChatModel(model)`: embed/rerank 모델 필터링
- `DEFAULT_MODEL`: 설치 모델 중 자동 추천 (없으면 설치 안내)
- 출처: openclaude `providerRecommendation.ts`

#### `pull.ts`
- `pullModel(modelName, onProgress)`: `POST /api/pull` 스트리밍으로 진행률 콜백 호출
- TUI 진행률 바와 연동

### 2. Optimizer Pipeline (`src/ollama/optimizer/`)

브릿지(`bridge_proxy_full.py`)의 코딩 성능 향상 로직을 TypeScript로 포팅.

**처리 순서:**
```
사용자 입력
    ↓ [1] Compactor    — 토큰 초과 시 히스토리 요약 압축
    ↓ [2] RAG          — 관련 코드 청크 시스템 프롬프트 주입
    ↓ [3] UltraPlan    — 복잡도 감지 → 계획 선생성 주입
    ↓ [4] CoT/Thinking — 모델별 추론 모드 활성화
    ↓
Ollama API (/v1/chat/completions)
    ↓ [5] <think> 태그 스트리밍 제거
    ↓
TUI / 헤드리스 출력
```

#### `cot.ts` — LocalModelOptimizer 포팅
- `forceCot(messages)`: 마지막 사용자 메시지에 "Think step-by-step..." 접미사 추가
- `applyThinkingMode(messages)`: Qwen3 등 thinking 모델에 `/think\n` 접두사 주입
- `stripThinkingTags(text)`: `<think>...</think>` 블록 제거
- `THINKING_MODELS`: `['qwen3', 'deepseek-r1', 'qwq', 'marco-o1']` (모델명 포함 여부로 감지)

#### `ultraplan.ts` — UltraPlan 포팅
- `isComplex(text)`: 길이 임계값(120자+) + 복잡도 키워드 정규식으로 감지
- `generatePlan(userText, model)`: ollama API로 5-10단계 구현 계획 생성 (temperature 0.2)
- `injectPlan(systemPrompt, plan)`: `## ULTRAPLAN — Pre-computed Implementation Plan` 블록 주입
- 계획 생성 실패 시 graceful skip (성능보다 가용성 우선)

#### `compactor.ts` — ConversationCompactor 포팅
- `estimateTokens(messages)`: 문자열 길이 ÷ 4 근사 추정
- `shouldCompact(messages, maxTokens)`: 24K 토큰 초과 + 최소 6턴 이상 시 압축
- `compact(messages, model)`: 오래된 턴 ollama로 요약 → 최근 4쌍 + 요약 블록 유지
- grok-cli 기존 `compaction.ts` 대체

#### `rag.ts` — RagContextInjector 포팅
- `indexDirectory(dir)`: 코드 파일을 500자 청크 + 100자 오버랩으로 분할 → nomic-embed-text 임베딩
- `query(userText, topK)`: 코사인 유사도로 관련 청크 검색 (임계값 0.30)
- `buildContext(userText)`: `## Relevant Code Context (RAG)` 블록 생성
- 인덱스 파일: `.ollama-cli-rag-index.json` (프로젝트 루트)
- RAG는 기본 비활성화, `ollama-cli rag index` 실행 후 활성화

#### `index.ts` — Pipeline 통합
- `OptimizerPipeline`: 설정에 따라 각 컴포넌트를 순서대로 적용
- `OptimizerConfig`: 각 기능 on/off 플래그 (`enableCoT`, `enableThinking`, `enableUltraPlan`, `enableRag`, `enableCompaction`)

### 3. CLI Commands (`src/index.ts`)

```
ollama-cli [message...]              인터랙티브 TUI 시작
  -m, --model <model>                사용할 모델
  -u, --base-url <url>               ollama 베이스 URL
  -d, --directory <dir>              작업 디렉터리
  -p, --prompt <prompt>              헤드리스 단일 프롬프트
  --format <text|json>               헤드리스 출력 형식
  -s, --session <id>                 이전 세션 이어서 (또는 'latest')
  --max-tool-rounds <n>              최대 도구 실행 라운드 (기본: 400)
  --no-cot                           CoT 강제 비활성화
  --no-ultraplan                     UltraPlan 비활성화
  --no-rag                           RAG 비활성화
  --update                           CLI 업데이트

ollama-cli models                    설치된 모델 목록 + 추천 표시
ollama-cli models pull <name>        모델 다운로드 (스트리밍 진행률)
ollama-cli models recommend [goal]   목표별 최적 모델 추천 (latency/balanced/coding)

ollama-cli rag index [dirs...]       코드베이스 RAG 인덱싱
ollama-cli rag stats                 인덱스 통계 출력

ollama-cli update                    최신 버전으로 업데이트
```

### 4. Settings System

**사용자 설정:** `~/.ollama-cli/settings.json`
```jsonc
{
  "defaultModel": "qwen2.5-coder:7b",
  "ollamaBaseUrl": "http://localhost:11434",
  "optimizer": {
    "enableCoT": true,
    "enableThinking": true,
    "enableUltraPlan": true,
    "enableRag": false,
    "enableCompaction": true
  },
  "mcp": { "servers": [] }
}
```

**프로젝트 설정:** `.ollama-cli/settings.json` (grok-cli 패턴 유지)

**환경변수:**
- `OLLAMA_BASE_URL` — ollama 호스트 오버라이드
- `OLLAMA_MODEL` — 모델 오버라이드
- `OLLAMA_CLI_NO_OPTIMIZER` — 최적화 레이어 전체 비활성화

---

## Data Flow

```
사용자 입력 (TUI or --prompt)
    ↓
processMessage() in agent.ts
    ↓
OptimizerPipeline.process(messages, systemPrompt)
    ├── Compactor.compact()      if shouldCompact()
    ├── Rag.buildContext()       if enableRag && indexExists
    ├── UltraPlan.inject()       if enableUltraPlan && isComplex()
    └── CoT.apply()              if enableCoT || isThinkingModel()
    ↓
Ollama API (OpenAI /v1/chat/completions)
    options: { keep_alive: -1 }  — 모델 RAM 상주
    options: { think: true }     — thinking 모델 시
    ↓
스트리밍 응답
    └── stripThinkingTags()      — <think> 블록 실시간 제거
    ↓
TUI 렌더링 / 헤드리스 stdout
```

---

## Dependencies

```diff
# 변경
- @ai-sdk/xai       → @ai-sdk/openai

# 제거
- grammy             (Telegram 브릿지)
- shuru sandbox 관련 코드

# 추가
  없음 (순수 TypeScript 구현, 기존 의존성 활용)
```

---

## Testing

vitest 기반, grok-cli 패턴 유지.

| 파일 | 테스트 대상 |
|---|---|
| `ollama/discovery.test.ts` | fetch mock으로 감지/미감지 케이스 |
| `ollama/models.test.ts` | 스코어링 순수 함수, 추천 결과 검증 |
| `ollama/optimizer/cot.test.ts` | 메시지 변환 입출력 |
| `ollama/optimizer/ultraplan.test.ts` | `isComplex()` 정규식 케이스 |
| `ollama/optimizer/compactor.test.ts` | 토큰 추정 + 압축 전후 메시지 수 |
| `ollama/pull.test.ts` | 스트리밍 응답 mock |

---

## Out of Scope

- Telegram 브릿지
- Shuru 샌드박스
- Batch API
- KairosDaemon (파일 감시 백그라운드 스레드) — 복잡도 대비 효용 낮음, 추후 추가 가능
- VerificationAgent — 레이턴시 영향 크므로 선택적 구현
