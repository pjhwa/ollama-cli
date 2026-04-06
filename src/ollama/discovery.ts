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
    const data = (await resp.json()) as {
      models?: Array<{
        name: string;
        size?: number;
        details?: { family?: string; parameter_size?: string; quantization_level?: string };
      }>;
    };
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
