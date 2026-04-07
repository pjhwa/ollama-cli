# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-04-07

Initial release of ollama-cli — forked from grok-cli, fully ported to local Ollama backend.

### Added
- Ollama backend: `@ai-sdk/openai` pointed at `http://localhost:11434/v1`, no API key required
- Ollama model discovery: `listOllamaModels`, `checkOllamaRunning`, `hasLocalOllama`
- Model management CLI: `ollama-cli models list`, `models pull`, `models recommend`
- Model recommendation engine with `latency` / `balanced` / `coding` strategies
- Model pull with streaming progress display
- Optimizer pipeline: CoT (Chain-of-Thought), UltraPlan, RAG — applied before each LLM call
- Thinking model support: auto-detects `qwen3`, `deepseek-r1`, `qwq`, `marco-o1` and applies `/think` mode
- RAG (Retrieval-Augmented Generation): `ollama-cli rag index` / `rag stats`
- `--no-cot`, `--no-ultraplan`, `--no-rag` CLI flags to disable optimizer stages per-session
- User settings at `~/.ollama-cli/user-settings.json`
- Project settings at `.ollama-cli/settings.json`
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_CLI_NO_OPTIMIZER` environment variable support

### Removed
- xAI / Grok API dependency (`@ai-sdk/xai`) — replaced with `@ai-sdk/openai`
- API key requirement
- Telegram remote control and audio transcription
- xAI Batch API
- Sandbox / Shuru microVM integration
- Verify workflow
- X search, web search, image generation, video generation tools (grok-specific)
- Audio/STT subsystem (whisper.cpp integration)
- Vision sub-agent (xAI Responses API)
