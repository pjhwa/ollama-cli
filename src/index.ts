#!/usr/bin/env node
import { program } from "commander";
import * as dotenv from "dotenv";
import * as path from "path";
import packageJson from "../package.json";
import { Agent } from "./agent/agent";
import {
  createHeadlessJsonlEmitter,
  type HeadlessOutputFormat,
  isHeadlessOutputFormat,
  renderHeadlessChunk,
  renderHeadlessPrelude,
} from "./headless/output";
import { hasLocalOllama, listOllamaModels } from "./ollama/discovery";
import type { RecommendationGoal } from "./ollama/models";
import { recommendModel } from "./ollama/models";
import { indexDirectory } from "./ollama/optimizer/rag";
import { pullModel } from "./ollama/pull";
import { startScheduleDaemon } from "./tools/schedule";
import { processAtMentions } from "./utils/at-mentions.js";
import { runScriptManagedUninstall } from "./utils/install-manager";
import { getCurrentModel, getOllamaBaseUrl, loadUserSettings, saveUserSettings } from "./utils/settings";
import { runUpdate } from "./utils/update-checker";

dotenv.config();

process.on("SIGTERM", () => process.exit(0));
process.on("uncaughtException", (err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

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

  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useKittyKeyboard: { disambiguate: true, alternateKeys: true },
  });
  const onExit = () => {
    renderer.destroy();
    process.exit(0);
  };

  createRoot(renderer).render(
    createElement(App, {
      agent,
      startupConfig: {
        apiKey: undefined,
        baseURL,
        model,
        maxToolRounds,
        sandboxMode: "off",
        sandboxSettings: {},
        version: packageJson.version,
      },
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
      try {
        process.chdir(options.directory as string);
      } catch (e: unknown) {
        console.error(`Cannot change to directory ${options.directory}: ${e instanceof Error ? e.message : e}`);
        process.exit(1);
      }
    }

    await checkOllamaRunning();

    const baseURL = (options.baseUrl as string | undefined) || getOllamaBaseUrl();
    const model = (options.model as string | undefined) || (await getCurrentModel());
    const maxToolRounds = parseInt((options.maxToolRounds as string) || "400", 10) || 400;

    if (typeof options.model === "string") saveUserSettings({ defaultModel: options.model });

    // Wire --no-cot / --no-ultraplan / --no-rag flags into optimizer settings for this session
    if (options.cot === false || options.ultraplan === false || options.rag === false) {
      const existing = loadUserSettings().optimizer ?? {};
      saveUserSettings({
        optimizer: {
          ...existing,
          ...(options.cot === false && { enableCoT: false }),
          ...(options.ultraplan === false && { enableUltraPlan: false }),
          ...(options.rag === false && { enableRag: false }),
        },
      });
    }

    if (options.prompt) {
      await runHeadless(
        options.prompt as string,
        baseURL,
        model,
        maxToolRounds,
        options.format as HeadlessOutputFormat,
        options.session as string | undefined,
      );
      return;
    }

    const initialMessage = message.length > 0 ? message.join(" ") : undefined;
    await startInteractive(baseURL, model, maxToolRounds, options.session as string | undefined, initialMessage);
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
    const goal = (options.goal as string as RecommendationGoal) || "balanced";
    const recommended = recommendModel(models, goal);
    console.log(`\nInstalled Ollama Models (goal: ${goal}):\n`);
    for (const m of models) {
      const isRec = m.name === recommended?.name;
      const tag = isRec ? " \x1b[32m<- recommended\x1b[0m" : "";
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
    await pullModel(
      name,
      (progress) => {
        const pct =
          progress.total && progress.completed ? ` ${Math.round((progress.completed / progress.total) * 100)}%` : "";
        const status = `${progress.status}${pct}`;
        if (status !== lastStatus) {
          process.stdout.write(`\r${status}    `);
          lastStatus = status;
        }
      },
      getOllamaBaseUrl(),
    );
    console.log(`\n${name} pulled successfully.`);
    saveUserSettings({ defaultModel: name });
  });

modelsCmd
  .command("recommend [goal]")
  .description("Recommend the best installed model (latency | balanced | coding)")
  .action(async (goal?: string) => {
    const normalizedGoal = (
      ["latency", "balanced", "coding"].includes(goal ?? "") ? goal : "balanced"
    ) as RecommendationGoal;
    const models = await listOllamaModels(getOllamaBaseUrl());
    const rec = recommendModel(models, normalizedGoal);
    if (!rec) {
      console.log("No suitable models found. Install one with: ollama pull <name>");
      return;
    }
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
      await indexDirectory(path.resolve(dir), baseURL);
      console.log("  Done");
    }
    console.log("RAG index updated. Re-run after code changes to refresh.");
    const existingOptimizer = loadUserSettings().optimizer ?? {};
    saveUserSettings({ optimizer: { ...existingOptimizer, enableRag: true } });
  });

ragCmd
  .command("stats")
  .description("Show RAG index statistics")
  .action(async () => {
    const { loadIndex } = await import("./ollama/optimizer/rag");
    const chunks = loadIndex();
    if (chunks.length === 0) {
      console.log("No RAG index found. Run: ollama-cli rag index");
      return;
    }
    const files = new Set(chunks.map((c: { path: string }) => c.path)).size;
    console.log(`\nRAG Index Stats:\n  Files: ${files}\n  Chunks: ${chunks.length}\n`);
  });

// ── Other commands ────────────────────────────────────────────────────────────

program
  .command("update")
  .description("Update ollama-cli to the latest release")
  .action(async () => {
    const result = await runUpdate(packageJson.version);
    console.log(result.output);
    process.exit(result.success ? 0 : 1);
  });

program
  .command("uninstall")
  .description("Remove ollama-cli binary and optional data")
  .option("--dry-run")
  .option("--force")
  .option("--keep-config")
  .option("--keep-data")
  .action(async (options) => {
    const result = await runScriptManagedUninstall({
      dryRun: !!options.dryRun,
      force: !!options.force,
      keepConfig: !!options.keepConfig,
      keepData: !!options.keepData,
    });
    console.log(result.output);
    process.exit(result.success ? 0 : 1);
  });

program
  .command("daemon")
  .description("Start the schedule daemon")
  .option("--background")
  .action(async (options) => {
    if (options.background) {
      const result = await startScheduleDaemon(process.cwd());
      console.log(result.alreadyRunning ? "Daemon already running." : "Daemon started.");
      return;
    }
    process.off("SIGTERM", () => process.exit(0));
    const { SchedulerDaemon } = await import("./daemon/scheduler");
    await new SchedulerDaemon().start();
  });

program.parse();
