import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { HooksConfig } from "../hooks/types";
import { listOllamaModels } from "../ollama/discovery";
import { recommendModel } from "../ollama/models";

export type McpTransport = "http" | "sse" | "stdio";

export interface OptimizerSettings {
  enableCoT?: boolean;
  enableThinking?: boolean;
  enableUltraPlan?: boolean;
  enableRag?: boolean;
  enableCompaction?: boolean;
}

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

// Keep these for backward compat with agent.ts that may still reference them
export type SandboxMode = "off";
export type SandboxSettings = {};

const USER_DIR = path.join(os.homedir(), ".ollama-cli");
const USER_SETTINGS_PATH = path.join(USER_DIR, "settings.json");

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function readJson<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
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

// Legacy stubs — kept so agent.ts and other files that import these don't break
// These will be cleaned up in Task 13
export function getCurrentSandboxMode(): SandboxMode {
  return "off";
}
export function getCurrentSandboxSettings(): SandboxSettings {
  return {};
}
export function mergeSandboxSettings(
  _base: SandboxSettings | undefined,
  _override: SandboxSettings | undefined,
): SandboxSettings {
  return {};
}
export function getApiKey(): string | undefined {
  return undefined;
}
export function getBaseURL(): string {
  return getOllamaBaseUrl();
}
export function getCurrentModelSync(): string {
  return loadUserSettings().defaultModel ?? "llama3.2";
}
export function normalizeModelId(modelId: string): string {
  return modelId.trim();
}
export function saveProjectSettings(_partial: Partial<ProjectSettings>): void {}
export function isReservedSubagentName(_name: string): boolean {
  return false;
}
export function parseSubAgentsRawList(_raw: unknown): CustomSubagentConfig[] {
  return [];
}
export function getReasoningEffortForModel(_modelId: string): undefined {
  return undefined;
}
