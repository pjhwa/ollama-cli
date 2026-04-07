import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { HooksConfig } from "../hooks/types";
import { listOllamaModels } from "../ollama/discovery";
import { recommendModel } from "../ollama/models";
import type { ReasoningEffort } from "../types/index";

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

export interface TelegramSettings {
  botToken?: string;
  approvedUserIds?: number[];
  sessionsByUserId?: Record<string, string>;
}

export interface UserSettings {
  defaultModel?: string;
  ollamaBaseUrl?: string;
  optimizer?: OptimizerSettings;
  mcp?: McpSettings;
  subAgents?: CustomSubagentConfig[];
  hooks?: HooksConfig;
  // Legacy compat fields — not used in ollama-cli
  apiKey?: string;
  reasoningEffortByModel?: Record<string, ReasoningEffort>;
  telegram?: TelegramSettings;
  sandbox?: SandboxSettings;
  sandboxMode?: SandboxMode;
}

export interface ProjectSettings {
  model?: string;
  sandboxMode?: SandboxMode;
  sandbox?: SandboxSettings;
}

// Sandbox types retained for compatibility — sandbox is always "off" in ollama-cli
export type SandboxMode = "off" | "shuru";
export interface SandboxSettings {
  allowNet?: boolean;
  allowedHosts?: string[];
  ports?: string[];
  cpus?: number;
  memory?: number;
  diskSize?: number;
  from?: string;
  verifyBaseFrom?: string;
  allowEphemeralInstall?: boolean;
  guestWorkdir?: string;
  syncHostWorkspace?: boolean;
  shellInit?: string[];
  hostBrowserCommandsOnHost?: boolean;
  secrets?: Array<{ name: string; fromEnv: string; hosts: string[] }>;
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
  base: SandboxSettings | undefined,
  override: SandboxSettings | undefined,
): SandboxSettings {
  if (!base && !override) return {};
  if (!base) return { ...override };
  if (!override) return { ...base };
  return {
    allowNet: override.allowNet ?? base.allowNet,
    allowedHosts: override.allowedHosts ?? base.allowedHosts,
    ports: override.ports ?? base.ports,
    cpus: override.cpus ?? base.cpus,
    memory: override.memory ?? base.memory,
    diskSize: override.diskSize ?? base.diskSize,
    from: override.from ?? base.from,
    verifyBaseFrom: override.verifyBaseFrom ?? base.verifyBaseFrom,
    allowEphemeralInstall: override.allowEphemeralInstall ?? base.allowEphemeralInstall,
    guestWorkdir: override.guestWorkdir ?? base.guestWorkdir,
    syncHostWorkspace: override.syncHostWorkspace ?? base.syncHostWorkspace,
    shellInit: override.shellInit ?? base.shellInit,
    hostBrowserCommandsOnHost: override.hostBrowserCommandsOnHost ?? base.hostBrowserCommandsOnHost,
    secrets: override.secrets ?? base.secrets,
  };
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
export function parseSubAgentsRawList(raw: unknown): CustomSubagentConfig[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const agents: CustomSubagentConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const model = typeof entry.model === "string" ? entry.model.trim() : "";
    const instruction = typeof entry.instruction === "string" ? entry.instruction : "";
    if (!name || !model) continue;
    const dedupeKey = name.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    agents.push({ name, model, instruction });
  }
  return agents;
}
export function getReasoningEffortForModel(_modelId: string): undefined {
  return undefined;
}
// Telegram stubs — kept for UI compatibility
export type McpRemoteTransport = McpTransport;
export function getTelegramBotToken(): string | undefined {
  return undefined;
}
export function saveApprovedTelegramUserId(_userId: number): void {}
export function normalizeSandboxSettings(raw: unknown): SandboxSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const result: SandboxSettings = {};
  if (typeof r.allowNet === "boolean") result.allowNet = r.allowNet;
  if (Array.isArray(r.allowedHosts))
    result.allowedHosts = r.allowedHosts.filter((h): h is string => typeof h === "string");
  if (Array.isArray(r.ports)) result.ports = r.ports.filter((p): p is string => typeof p === "string");
  if (typeof r.cpus === "number") result.cpus = r.cpus;
  if (typeof r.memory === "number") result.memory = r.memory;
  if (typeof r.diskSize === "number") result.diskSize = r.diskSize;
  if (typeof r.from === "string") result.from = r.from;
  if (typeof r.verifyBaseFrom === "string") result.verifyBaseFrom = r.verifyBaseFrom;
  if (typeof r.allowEphemeralInstall === "boolean") result.allowEphemeralInstall = r.allowEphemeralInstall;
  if (typeof r.guestWorkdir === "string") result.guestWorkdir = r.guestWorkdir;
  if (typeof r.syncHostWorkspace === "boolean") result.syncHostWorkspace = r.syncHostWorkspace;
  if (Array.isArray(r.shellInit)) result.shellInit = r.shellInit.filter((s): s is string => typeof s === "string");
  if (typeof r.hostBrowserCommandsOnHost === "boolean") result.hostBrowserCommandsOnHost = r.hostBrowserCommandsOnHost;
  return result;
}
export function normalizeSandboxMode(_value: unknown): SandboxMode {
  return "off";
}
