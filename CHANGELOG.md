# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.3] - 2026-04-08

### Fixed
- Install manager path corrected: `getGrokUserDir()` now returns `~/.ollama-cli/` (was `~/.grok/`), fixing `/update` "not script-managed" error
- Release asset names corrected to `ollama-cli-{platform}` in `getReleaseTargetForPlatformKey()` (were `grok-{platform}`)

### Changed
- All remaining "Grok" branding removed from user-visible strings: splash screen, update notifications, menus, input placeholder, Telegram labels, daemon reminder messages
- README: added optimizer pipeline explanation, context compaction, tool-result truncation, acknowledgements (grok-cli fork, graphify inspiration, claude-code inspiration)
- `docs/superpowers/specs/` and `docs/superpowers/plans/` rewritten in English reflecting actual implementation

## [1.0.2] - 2026-04-07

### Fixed
- `@ai-sdk/openai` v3 Chat Completions mode: changed `provider(modelId)` → `provider.chat(modelId)` to avoid Responses API which generates `item_reference` content types unsupported by Ollama
- `OllamaModel` type updated to `ReturnType<OllamaProvider["chat"]>`

### Changed
- `src/ui/app.tsx`: API key error message updated to reflect Ollama (no key required)
- `src/tools/tools.ts`: daemon schedule reminder updated to `ollama-cli daemon`
- `src/ui/telegram-turn-ui.ts`: source label updated to `Telegram ollama-cli`

## [1.0.1] - 2026-04-07

### Fixed
- `node:sqlite` → `bun:sqlite`: replaced `DatabaseSync` from `node:sqlite` (Node.js 22+ only) with `Database` from `bun:sqlite` (Bun built-in), fixing startup crash
- bun:sqlite named parameters: added `@` prefix to all named param keys in `workspaces.ts` and `sessions.ts` (`{ id }` → `{ "@id" }`), fixing `NOT NULL constraint failed` on session creation

### Changed
- GitHub Actions release workflow: removed `--frozen-lockfile` flag (lockfile version mismatch); removed `linux-arm64` (native module cross-compile failure); removed `darwin-x64` (`macos-13` runner deprecated). Final matrix: linux-x64, darwin-arm64, windows-x64

## [1.0.0] - 2026-04-06

Initial release of ollama-cli — forked from grok-cli, fully ported to local Ollama backend.

### Added
- Ollama backend: `@ai-sdk/openai` pointed at `http://localhost:11434/v1`, no API key required
- Ollama model discovery: `hasLocalOllama()`, `listOllamaModels()`, `getOllamaChatBaseUrl()`
- Model management CLI: `ollama-cli models list`, `models pull`, `models recommend`
- Model recommendation engine with `latency` / `balanced` / `coding` goal strategies
- Model pull with streaming progress display
- Optimizer pipeline: CoT (Chain-of-Thought), UltraPlan, RAG — applied before each LLM call
- Thinking model support: auto-detects `qwen3`, `deepseek-r1`, `qwq`, `marco-o1` and applies `/think` mode + strips `<think>` blocks from output
- RAG indexer: TF-IDF bag-of-words embeddings over `.ts` files, cosine similarity search, `ollama-cli rag index` / `rag stats`
- `--no-cot`, `--no-ultraplan`, `--no-rag` CLI flags to disable optimizer stages per-session
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_CLI_NO_OPTIMIZER` environment variable support
- User settings at `~/.ollama-cli/user-settings.json` with optimizer enable/disable controls
- Project settings at `.ollama-cli/settings.json` (per-project model override)
- GitHub Actions release workflow: standalone binary compilation via `bun build --compile`
- `install.sh` curl-pipe install script

### Changed
- Config directory: `~/.grok/` → `~/.ollama-cli/`
- Binary name: `grok` → `ollama-cli`
- SQLite driver: `node:sqlite` (attempted) → `bun:sqlite`
- Named SQL parameters: `{ key }` → `{ "@key" }` (bun:sqlite format)

### Removed
- xAI / Grok API dependency (`@ai-sdk/xai`) — replaced with `@ai-sdk/openai`
- API key requirement
- Telegram remote control (stub remains, API key returns `undefined`)
- Audio/STT subsystem (whisper.cpp integration)
- xAI Batch API
- Sandbox / Shuru microVM integration
- X search, web search, image generation, video generation tools (xAI-specific)

[1.0.3]: https://github.com/pjhwa/ollama-cli/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/pjhwa/ollama-cli/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/pjhwa/ollama-cli/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/pjhwa/ollama-cli/releases/tag/v1.0.0
