# ollama-cli

[![CI](https://github.com/pjhwa/ollama-cli/actions/workflows/typecheck.yml/badge.svg)](https://github.com/pjhwa/ollama-cli/actions/workflows/typecheck.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A local AI coding agent CLI that runs entirely on [Ollama](https://ollama.com) — no API keys, no cloud, no cost per token. Powered by OpenTUI + React terminal UI, with a built-in optimizer pipeline (CoT, UltraPlan, RAG) that improves response quality before each LLM call.

Open source. Terminal-native. Built on Node.js.

---

## Prerequisites

- [Ollama](https://ollama.com) running locally (`ollama serve`)
- Node.js 18+
- At least one model pulled: `ollama pull llama3.2`

---

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/pjhwa/ollama-cli/main/install.sh | bash
```

**Alternative (from source):**

```bash
git clone https://github.com/pjhwa/ollama-cli.git
cd ollama-cli
npm install
npm run build
node dist/index.js
```

**Self-management (script-installed only):**

```bash
ollama-cli update
ollama-cli uninstall
ollama-cli uninstall --dry-run
ollama-cli uninstall --keep-config
```

---

## Run it

**Interactive (default)** — launches the OpenTUI coding agent:

```bash
ollama-cli
```

**Pick a project directory:**

```bash
ollama-cli -d /path/to/your/repo
```

**Headless** — one prompt, then exit:

```bash
ollama-cli --prompt "run the test suite and summarize failures"
ollama-cli -p "show me package.json" --directory /path/to/project
ollama-cli --prompt "refactor X" --max-tool-rounds 30
ollama-cli --prompt "summarize the repo state" --format json
```

**Continue a saved session:**

```bash
ollama-cli --session latest
ollama-cli -s <session-id>
```

**Structured headless output:**

```bash
ollama-cli --prompt "summarize the repo state" --format json
```

`--format json` emits a newline-delimited JSON event stream with step-level records: `step_start`, `text`, `tool_use`, `step_finish`, `error`.

**Pass an opening message directly:**

```bash
ollama-cli fix the flaky test in src/foo.test.ts
```

### Optimizer flags

The optimizer pipeline runs automatically before each LLM call. Disable individual stages per-session:

```bash
ollama-cli --no-cot        # Disable Chain-of-Thought forcing
ollama-cli --no-ultraplan  # Disable UltraPlan pre-processing
ollama-cli --no-rag        # Disable RAG context injection
```

### Supported terminals

For the most reliable interactive OpenTUI experience:

- **WezTerm** (cross-platform)
- **Alacritty** (cross-platform)
- **Ghostty** (macOS and Linux)
- **Kitty** (macOS and Linux)

### Scheduling

Schedules let ollama-cli run a headless prompt on a recurring schedule. Ask for it in natural language:

```text
Create a schedule named daily-changelog-update that runs every weekday at 9am
and updates CHANGELOG.md from the latest merged commits.
```

Recurring schedules require the background daemon:

```bash
ollama-cli daemon --background
```

Use `/schedule` in the TUI to browse saved schedules.

---

## Model management

**List available local models with recommendations:**

```bash
ollama-cli models list
ollama-cli models list --goal coding   # coding / balanced / latency
```

**Pull a model:**

```bash
ollama-cli models pull llama3.2
ollama-cli models pull qwen3:14b
```

**Recommend the best available model for a goal:**

```bash
ollama-cli models recommend --goal balanced
```

---

## RAG (Retrieval-Augmented Generation)

Index your codebase so the agent can retrieve relevant context automatically:

```bash
ollama-cli rag index              # index current directory
ollama-cli rag index src/ docs/   # index specific directories
ollama-cli rag stats              # show index statistics
```

Indexing also enables RAG for future sessions (saved to user settings).

---

## What you get

| Feature | Description |
|---------|-------------|
| **Ollama-native** | Runs any model available in your local Ollama instance — `llama3.2`, `qwen3`, `deepseek-r1`, `mistral`, and more |
| **Optimizer pipeline** | CoT (Chain-of-Thought), UltraPlan (structured planning), RAG (code context retrieval) applied before each LLM call |
| **Thinking model support** | Auto-detects thinking models (`qwen3`, `deepseek-r1`, `qwq`) and applies `/think` mode + strips `<think>` blocks from output |
| **Sub-agents** | Foreground `task` delegation (explore, general, computer) plus background `delegate` for parallel deep dives |
| **Computer use** | Built-in `computer` sub-agent for host desktop automation via `agent-desktop` |
| **Custom sub-agents** | Define named agents with `subAgents` in `~/.ollama-cli/user-settings.json` and manage them from the TUI with `/agents` |
| **Sessions** | Conversations persist; `--session latest` picks up where you left off |
| **Hooks** | Shell commands at key lifecycle events — enforce policies, run linters, log activity |
| **MCPs** | Extend with Model Context Protocol servers — configure via `/mcps` in the TUI or `.ollama-cli/settings.json` |
| **Skills** | Agent Skills under `.agents/skills/<name>/SKILL.md` (project) or `~/.agents/skills/` (user) |
| **Headless** | `--prompt` / `-p` for non-interactive runs — pipe it, script it, bench it |
| **Hackable** | TypeScript, clear agent loop, bash-first tools — fork it |

---

## Configuration

**User settings** — `~/.ollama-cli/user-settings.json`:

```json
{
  "defaultModel": "llama3.2",
  "ollamaBaseUrl": "http://localhost:11434",
  "optimizer": {
    "enableCoT": true,
    "enableThinking": true,
    "enableUltraPlan": true,
    "enableRag": false,
    "enableCompaction": true
  }
}
```

**Environment variables:**

```bash
OLLAMA_BASE_URL=http://localhost:11434   # Ollama server URL
OLLAMA_MODEL=qwen3:14b                  # Override model
OLLAMA_CLI_NO_OPTIMIZER=1               # Disable entire optimizer pipeline
```

**Custom sub-agents** — add to `~/.ollama-cli/user-settings.json`:

```json
{
  "subAgents": [
    {
      "name": "security-review",
      "model": "qwen3:14b",
      "instruction": "Prioritize security implications and suggest concrete fixes."
    }
  ]
}
```

**Project settings** — `.ollama-cli/settings.json` (per-project model override):

```json
{ "model": "deepseek-r1:8b" }
```

---

## Hooks

Configure in `~/.ollama-cli/user-settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "bash",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/lint-before-edit.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Hook commands receive JSON on **stdin** and can return JSON on **stdout**. Exit code `0` = success, `2` = block the action, other = non-blocking error.

**Supported events:** `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `UserPromptSubmit`, `SessionStart`, `SessionEnd`, `Stop`, `StopFailure`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `PreCompact`, `PostCompact`, `Notification`, `InstructionsLoaded`, `CwdChanged`.

---

## Instructions & project brain

- `AGENTS.md` — merged from git root down to your cwd. `AGENTS.override.md` wins per directory when present.

---

## Development

From a clone:

```bash
npm install
npm run build
node dist/index.js
```

Other useful commands:

```bash
npm run typecheck
npm run lint
npm test          # vitest
```

---

## How local model performance is improved

Local models (Llama, Qwen, DeepSeek, etc.) are smaller than cloud models and benefit from explicit
scaffolding. ollama-cli applies a four-stage **optimizer pipeline** before every LLM call, plus
several session-level techniques.

### 1. RAG — Retrieval-Augmented Generation

Index your codebase once with `ollama-cli rag index`. Before each request, the optimizer queries
the index with cosine-similarity search over TF-IDF-style bag-of-words embeddings (or
`nomic-embed-text` when available) and injects the top-5 most relevant code chunks directly into
the system prompt:

```
## Relevant Code Context (RAG)

### src/utils/settings.ts (relevance: 87%)
```

This grounds the model in your actual code instead of relying on its training data, which
dramatically reduces hallucinated API calls and wrong file paths.

**Enable:** `ollama-cli rag index` (once per project), then RAG runs automatically.  
**Disable per-session:** `--no-rag`

---

### 2. UltraPlan — pre-computed implementation plan

For complex requests (≥ 120 characters containing keywords like *implement*, *refactor*,
*migrate*, *architect*, etc.) a **fast secondary call** to the same model is made first with a
software-architect persona:

> "Produce a concise numbered implementation plan (5-10 steps). Output ONLY the plan."

The resulting plan is injected as a `## ULTRAPLAN` block in the system prompt before the main
call. This separates *planning* from *execution*, reducing the chance the model gets lost
mid-task on multi-step coding problems — a known weakness of smaller models.

**Disable per-session:** `--no-ultraplan`

---

### 3. CoT — Chain-of-Thought forcing

A suffix is appended to every user message:

> "Think step-by-step before answering. Show your reasoning, then provide the final answer."

This single prompt addition reliably improves accuracy on reasoning-heavy tasks (debugging,
algorithm design, multi-file refactors) for models that were instruction-tuned on CoT data —
which includes most modern open-weight models. No extra inference call is required.

**Disable per-session:** `--no-cot`

---

### 4. Thinking mode (extended reasoning)

For models that expose an extended-reasoning mode (`qwen3`, `deepseek-r1`, `qwq`, `marco-o1`),
the optimizer prepends `/think` to the user message. This instructs the model to emit a hidden
`<think>…</think>` scratchpad before the final response. The scratchpad is stripped from
displayed output but the reasoning quality benefit carries over to the final answer.

This is equivalent to enabling the model's "extended thinking" without any API-level parameter —
just a prompt prefix that these models are trained to respond to.

**Auto-enabled** for recognized thinking models. Disable with `OLLAMA_CLI_NO_OPTIMIZER=1`.

---

### 5. Context compaction

As a session grows, the message history is automatically **summarized** when it approaches the
model's context limit. A structured checkpoint is generated:

```
## Goal / Constraints & Preferences / Progress / Key Decisions / Next Steps / Open Questions
```

This checkpoint replaces the older messages so the agent can continue working without losing
task continuity — solving the context-overflow problem that causes local models to "forget" what
they were doing.

---

### 6. Tool-result truncation

Raw tool outputs (bash stdout, file reads, search results) are truncated to 2 000 characters
before being appended to the message history. This prevents a single verbose tool response from
consuming the entire context window of a local model.

---

### Pipeline summary

```
User prompt
    │
    ▼
[1] RAG  →  inject relevant code chunks into system prompt
    │
    ▼
[2] UltraPlan  →  pre-generate numbered implementation plan (complex tasks only)
    │
    ▼
[3] CoT  →  append "Think step-by-step" to user message
    │
    ▼
[4] Thinking mode  →  prepend /think for models that support it
    │
    ▼
  LLM call (Ollama)
```

All stages can be disabled individually (`--no-cot`, `--no-ultraplan`, `--no-rag`) or entirely
(`OLLAMA_CLI_NO_OPTIMIZER=1`).

---

## Acknowledgements

ollama-cli builds on the shoulders of several open-source projects and ideas.

### Direct fork

**[grok-cli](https://github.com/superagent-ai/grok-cli)** by superagent-ai — the upstream project this was forked from.
ollama-cli started as grok-cli with the xAI/Grok backend replaced by a local Ollama backend.
The agent loop, sub-agent system, tool set, OpenTUI terminal UI, MCP integration, skills system,
session/transcript storage, hooks, scheduling daemon, and install/update infrastructure all originate from grok-cli.

### Inspiration

**[graphify](https://github.com/safishamsi/graphify)** by safishamsi — a repository-to-knowledge-graph converter
that parses code with Tree-sitter, applies Leiden clustering to detect architectural patterns, and enriches
relationships with LLM vision. graphify's approach to reducing RAG token consumption (up to 71.5× compared to
raw file queries) and its transparency model (`EXTRACTED` / `INFERRED` / `AMBIGUOUS` tagging) directly
influenced the design philosophy behind the ollama-cli RAG indexer and optimizer pipeline.

### Key libraries & frameworks

| Library | Role |
|---------|------|
| [Vercel AI SDK](https://sdk.vercel.ai) (`ai`, `@ai-sdk/openai`) | LLM streaming, tool-calling, multi-step agent loop |
| [OpenTUI](https://github.com/felixrieseberg/opentui) (`@opentui/core`, `@opentui/react`) | React-based terminal UI renderer |
| [Model Context Protocol](https://modelcontextprotocol.io) (`@modelcontextprotocol/sdk`) | MCP server integration |
| [agent-desktop](https://github.com/superagent-ai/agent-desktop) | Host desktop automation for computer-use sub-agent |
| [Ollama](https://ollama.com) | Local LLM runtime — model serving, embedding, pull |
| [Bun](https://bun.sh) | JavaScript runtime used for standalone binary compilation |

---

## License

MIT
