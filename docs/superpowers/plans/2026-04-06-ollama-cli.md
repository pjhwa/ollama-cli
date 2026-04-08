# ollama-cli Implementation Record

**Date:** 2026-04-06  
**Last updated:** 2026-04-08  
**Status:** Completed (v1.0.3 released)  
**Repository:** https://github.com/pjhwa/ollama-cli

---

## Goal

Port grok-cli into a local-only AI coding agent powered by Ollama. Replace the xAI/Grok backend
with Ollama's OpenAI-compatible Chat Completions endpoint. Add a four-stage optimizer pipeline
(RAG, UltraPlan, CoT, Thinking mode) that measurably improves coding task quality on smaller
local models. Publish as a standalone binary via GitHub Releases.

**Base fork:** [grok-cli](https://github.com/superagent-ai/grok-cli) by superagent-ai  
**Runtime:** Bun 1.3.x (standalone binary via `bun build --compile`)  
**Tech stack:** TypeScript, Bun, Vercel AI SDK (`ai`, `@ai-sdk/openai`), OpenTUI + React, bun:sqlite, Commander.js, Vitest

---

## What Was Built

### New files

| Path | Purpose |
|------|---------|
| `src/ollama/discovery.ts` | `hasLocalOllama()`, `listOllamaModels()`, `getOllamaChatBaseUrl()`, `getOllamaBaseUrl()` |
| `src/ollama/client.ts` | `createProvider()`, `resolveModelRuntime()` (forces Chat Completions via `provider.chat()`), `isThinkingModel()` |
| `src/ollama/models.ts` | `OllamaModelDescriptor`, `recommendModel()`, `isViableOllamaChatModel()` |
| `src/ollama/pull.ts` | `pullModel()` — streaming `POST /api/pull` with progress callback |
| `src/ollama/optimizer/cot.ts` | `forceCot()`, `applyThinkingMode()`, `stripThinkingTags()` |
| `src/ollama/optimizer/ultraplan.ts` | `isComplexRequest()`, `generatePlan()`, `injectPlan()` |
| `src/ollama/optimizer/rag.ts` | `indexDirectory()`, `queryIndex()`, `buildContextBlock()` — TF-IDF bag-of-words embeddings |
| `src/ollama/optimizer/index.ts` | `runOptimizerPipeline()` — orchestrates all four stages |
| `.github/workflows/release.yml` | CI/CD: build on `v*` tags across ubuntu-latest, macos-latest, windows-latest |
| `install.sh` | curl-pipe install script writing to `~/.ollama-cli/` |

### Modified files

| Path | Key changes |
|------|------------|
| `package.json` | name/bin/description; `@ai-sdk/xai` → `@ai-sdk/openai ^3.x`; version 1.0.0 → 1.0.3 |
| `src/index.ts` | Full rewrite: `ollama-cli` root command + `models list/pull/recommend` + `rag index/stats` subcommands; `--no-cot`, `--no-ultraplan`, `--no-rag` flags |
| `src/utils/settings.ts` | Config path `~/.grok/` → `~/.ollama-cli/`; no API key; added `OptimizerSettings` (enableCoT, enableThinking, enableUltraPlan, enableRag, enableCompaction) |
| `src/utils/install-manager.ts` | All `grok-*` → `ollama-cli-*` asset names; repo `superagent-ai/grok-cli` → `pjhwa/ollama-cli`; user dir `~/.grok` → `~/.ollama-cli`; all user-visible "Grok" strings → "ollama-cli" |
| `src/utils/update-checker.test.ts` | RELEASE_URL updated to `pjhwa/ollama-cli` |
| `src/agent/agent.ts` | `@ai-sdk/xai` → `@ai-sdk/openai` import; optimizer pipeline integrated into `processUserTurn()`; sandbox/batch code removed |
| `src/agent/compaction.ts` | Provider import updated from XaiProvider → OllamaProvider |
| `src/storage/db.ts` | `import { DatabaseSync } from "node:sqlite"` → `import { Database } from "bun:sqlite"` |
| `src/storage/workspaces.ts` | Named params `{ key: val }` → `{ "@key": val }` (bun:sqlite requirement) |
| `src/storage/sessions.ts` | Same named param fix throughout |
| `src/ui/app.tsx` | All "Grok" → "ollama-cli" / "Ollama" in splash, update notifications, menus, placeholders, API key error messages |
| `src/ui/telegram-turn-ui.ts` | `"Telegram Grok"` → `"Telegram ollama-cli"` |
| `src/tools/tools.ts` | `"grok daemon"` → `"ollama-cli daemon"` in schedule reminder message |
| `README.md` | Complete rewrite with Ollama setup, optimizer pipeline explanation, configuration, hooks, acknowledgements |
| `docs/superpowers/specs/2026-04-06-ollama-cli-design.md` | Rewritten in English reflecting v1.0.3 implementation |

### Removed

- `src/grok/` — replaced by `src/ollama/`
- `src/telegram/` — stub code remains in `src/telegram/` but API key logic returns `undefined`; bridge is disabled
- `src/audio/` — removed entirely (no Ollama equivalent)
- xAI Batch API integration — removed
- Shuru sandbox integration — removed

---

## Critical Bug Fixes (Post-Initial-Port)

### 1. `node:sqlite` not available in Bun

**Symptom:** `Error: No such built-in module: node:sqlite` on startup  
**Root cause:** `node:sqlite` is a Node.js 22+ built-in. Bun has its own `bun:sqlite`.  
**Fix:** `src/storage/db.ts` — changed import from `node:sqlite` `DatabaseSync` to `bun:sqlite` `Database`.

### 2. bun:sqlite named parameter format

**Symptom:** `SQLiteError: NOT NULL constraint failed: workspaces.id` on first session  
**Root cause:** bun:sqlite requires `@`-prefixed keys in named parameter objects: `{ "@id": id }`, not `{ id }`.  
**Fix:** `src/storage/workspaces.ts` and `src/storage/sessions.ts` — all named param objects updated.

### 3. `@ai-sdk/openai` v3 Responses API conflict

**Symptom:** `Error: input[2]: unknown input item type: item_reference` during agent tool calls  
**Root cause:** `@ai-sdk/openai` v3 defaults to the OpenAI Responses API. Ollama only supports Chat Completions. Using `provider(modelId)` selects Responses API; `provider.chat(modelId)` forces Chat Completions.  
**Fix:** `src/ollama/client.ts` — changed `resolveModelRuntime()` and `generateTitle()` to use `provider.chat(modelId)`. Also updated `OllamaModel` type from `ReturnType<OllamaProvider>` to `ReturnType<OllamaProvider["chat"]>`.

### 4. `/update` "not script-managed" error

**Symptom:** `Update failed: This install is not script-managed, so 'grok update' cannot proceed.`  
**Root causes:**
1. `getGrokUserDir()` returned `~/.grok` but `install.sh` writes `install.json` to `~/.ollama-cli/`
2. `getReleaseTargetForPlatformKey()` returned `grok-darwin-arm64` instead of `ollama-cli-darwin-arm64`

**Fix:** `src/utils/install-manager.ts` — corrected user dir path and all asset name strings.

### 5. GitHub Actions release workflow

**Issues encountered:**
- `bun install --frozen-lockfile` failed due to lockfile version mismatch → changed to `bun install`
- `linux-arm64` cross-compilation blocked by `@opentui/core` native modules → removed from matrix
- `macos-13` runner no longer available → `darwin-x64` removed; `macos-latest` (arm64 only) used

**Final matrix:** `ubuntu-latest` (linux-x64), `macos-latest` (darwin-arm64), `windows-latest` (windows-x64)

---

## Optimizer Pipeline

Four stages run in sequence before every LLM call. Any stage can be disabled independently.

```
User prompt
    │
[1] RAG          → inject top-5 relevant code chunks into system prompt
[2] UltraPlan    → pre-generate numbered plan for complex requests (≥120 chars + keywords)
[3] CoT          → append "Think step-by-step..." to last user message
[4] Thinking     → prepend /think for qwen3 / deepseek-r1 / qwq / marco-o1
    │
Ollama API  (POST /v1/chat/completions via Chat Completions mode)
    │
strip <think>…</think> from streamed output
    │
TUI / headless stdout
```

Disable flags: `--no-cot`, `--no-ultraplan`, `--no-rag`, `OLLAMA_CLI_NO_OPTIMIZER=1`

---

## Release History

| Version | Date | Key changes |
|---------|------|-------------|
| v1.0.0 | 2026-04-06 | Initial release — Ollama port, optimizer pipeline |
| v1.0.1 | 2026-04-07 | Fix: node:sqlite → bun:sqlite; bun:sqlite named param `@` prefix |
| v1.0.2 | 2026-04-07 | Fix: @ai-sdk/openai v3 Chat Completions mode (`provider.chat()`); remove all "Grok" branding |
| v1.0.3 | 2026-04-08 | Fix: install-manager path/asset names; README acknowledgements + optimizer docs |

---

## Architecture Notes

### Why `provider.chat()` instead of `provider()`

`@ai-sdk/openai` v3 introduced a "Responses API" mode as the default for `provider(modelId)`.
Ollama's `/v1/chat/completions` endpoint is Chat Completions only. The `provider.chat(modelId)`
call explicitly selects Chat Completions mode and avoids the `item_reference` content type that
the Responses API inserts.

### Why bun:sqlite instead of node:sqlite

Bun has `bun:sqlite` built-in since early versions. `node:sqlite` is Node.js 22+ only and not
available in Bun. The APIs are similar but named parameter syntax differs: bun:sqlite requires
`{ "@key": value }` where node:sqlite accepts `{ key: value }`.

### Why no linux-arm64 / darwin-x64 binaries

`@opentui/core` includes native Node.js addons that must be compiled for the target platform.
Bun's `--compile` cross-compilation cannot compile these native modules for a different
architecture. The `macos-13` GitHub Actions runner (needed for darwin-x64) was deprecated.
These platforms are listed as known limitations.

### Context compaction

Sessions approaching the model context limit are automatically summarized into a structured
checkpoint (Goal / Constraints / Progress / Key Decisions / Next Steps / Open Questions).
The checkpoint replaces old turns; recent turns are kept verbatim. Constants:
- `DEFAULT_RESERVE_TOKENS = 16_384`
- `DEFAULT_KEEP_RECENT_TOKENS = 20_000`
- `TOOL_RESULT_MAX_CHARS = 2_000`
