import { getOllamaBaseUrl } from "./discovery";

export interface PullProgress {
  status: string;
  completed?: number;
  total?: number;
  digest?: string;
}

export type PullProgressCallback = (progress: PullProgress) => void;

export async function pullModel(modelName: string, onProgress?: PullProgressCallback, baseUrl?: string): Promise<void> {
  const resp = await fetch(`${getOllamaBaseUrl(baseUrl)}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: modelName, stream: true }),
  });

  if (!resp.ok) {
    throw new Error(`Pull failed: HTTP ${resp.status}`);
  }

  const reader = resp.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line) as PullProgress;
        onProgress?.(data);
      } catch {
        // skip malformed lines
      }
    }
  }
}
