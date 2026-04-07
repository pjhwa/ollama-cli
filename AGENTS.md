# AGENTS.md

## ollama-cli — agent/AI coding assistant instructions

### Overview

`ollama-cli` is a single-package TypeScript CLI tool — no databases, Docker, or background services required beyond a running Ollama instance. See `README.md` for full documentation and usage.

### Quick reference

| Action        | Command                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| Install deps  | `npm install` (installs Husky; pre-commit runs Biome on staged files)     |
| Typecheck     | `npm run typecheck`                                                       |
| Lint          | `npm run lint`                                                            |
| Test          | `npm test` (vitest)                                                       |
| Build         | `npm run build`                                                           |
| Run built CLI | `node dist/index.js`                                                      |
| Headless mode | `node dist/index.js --prompt "..." --max-tool-rounds N`                   |
| CLI help      | `node dist/index.js --help`                                               |

### Architecture

- **`src/ollama/`** — Ollama backend: discovery, client, model management, pull, optimizer pipeline
  - `discovery.ts` — listOllamaModels, checkOllamaRunning, hasLocalOllama
  - `client.ts` — createProvider (wraps @ai-sdk/openai pointed at localhost:11434), resolveModelRuntime, generateTitle
  - `models.ts` — recommendModel with latency/balanced/coding strategies
  - `pull.ts` — pullModel with streaming progress
  - `optimizer/` — CoT, UltraPlan, RAG pipeline (`index.ts` orchestrates all three)
- **`src/agent/`** — core agent loop (`agent.ts`), compaction (`compaction.ts`)
- **`src/tools/`** — tool definitions (`tools.ts`), bash, computer, schedule, etc.
- **`src/ui/`** — OpenTUI React terminal UI (`app.tsx`)
- **`src/utils/settings.ts`** — user/project settings, optimizer settings, MCP servers
- **`src/index.ts`** — CLI entrypoint (Commander.js): interactive, headless, models, rag subcommands

### Environment

- **Node.js 18+** required (not Bun — Bun is not installed in this project's runtime)
- **Ollama** must be running locally: `ollama serve`
- No API key required — ollama-cli connects to `http://localhost:11434` by default
- Override with `OLLAMA_BASE_URL`, `OLLAMA_MODEL` environment variables

### Known issues / notes

- The `src/grok/` directory contains minimal stubs retained for type compatibility with the UI layer. Do not add new code there.
- `src/telegram/bridge.ts` and `src/telegram/pairing.ts` are no-op stubs — Telegram support has been removed.
- Sandbox mode is always `"off"` — sandbox infrastructure is stubbed out.
- `dev` mode runs from source via `tsx`; prefer `npm run build && node dist/index.js` for testing CLI behavior.
