import * as fs from "fs";
import * as path from "path";
import { getOllamaBaseUrl } from "../discovery";

export const RAG_INDEX_FILE = ".ollama-cli-rag-index.json";
const RAG_EMBED_MODEL = "nomic-embed-text";
const RAG_CHUNK_SIZE = 500;
const RAG_CHUNK_OVERLAP = 100;
const RAG_TOP_K = 5;
const RAG_THRESHOLD = 0.3;

export interface RagChunk {
  path: string;
  text: string;
  embedding: number[];
  mtime: number;
}

export interface ScoredChunk {
  path: string;
  text: string;
  score: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * (b[i] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

export function chunkText(text: string, size = RAG_CHUNK_SIZE, overlap = RAG_CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}

async function embed(text: string, baseUrl: string): Promise<number[]> {
  for (const [endpoint, body] of [
    ["/api/embed", { model: RAG_EMBED_MODEL, input: text }] as const,
    ["/api/embeddings", { model: RAG_EMBED_MODEL, prompt: text }] as const,
  ]) {
    try {
      const resp = await fetch(`${getOllamaBaseUrl(baseUrl)}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (!resp.ok) continue;
      const data = (await resp.json()) as { embeddings?: number[][]; embedding?: number[] };
      const emb = (data.embeddings ?? [[]])[0] ?? data.embedding ?? [];
      if (emb.length > 0) return emb;
    } catch {
      /* try next endpoint */
    }
  }
  return [];
}

export function loadIndex(indexPath: string): RagChunk[] {
  try {
    if (!fs.existsSync(indexPath)) return [];
    return JSON.parse(fs.readFileSync(indexPath, "utf-8")) as RagChunk[];
  } catch {
    return [];
  }
}

export function saveIndex(indexPath: string, chunks: RagChunk[]): void {
  fs.writeFileSync(indexPath, JSON.stringify(chunks, null, 2));
}

const INDEXABLE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".c", ".cpp", ".h", ".md"]);
const SKIP_DIRS = new Set([".git", "node_modules", "target", "__pycache__", ".venv", "dist"]);

export async function indexDirectory(
  dir: string,
  baseUrl: string,
  indexPath = RAG_INDEX_FILE,
  onFile?: (filePath: string) => void,
): Promise<void> {
  const existing = loadIndex(indexPath);
  const chunkMap = new Map<string, RagChunk[]>();
  for (const c of existing) {
    const arr = chunkMap.get(c.path) ?? [];
    arr.push(c);
    chunkMap.set(c.path, arr);
  }

  const walk = async (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!INDEXABLE_EXTS.has(path.extname(entry.name))) continue;
      const mtime = fs.statSync(full).mtimeMs;
      const existingChunks = chunkMap.get(full);
      if (existingChunks && existingChunks[0] && existingChunks[0].mtime >= mtime) continue;
      onFile?.(full);
      const text = fs.readFileSync(full, "utf-8");
      const chunks = chunkText(text);
      const newChunks: RagChunk[] = [];
      for (const chunk of chunks) {
        const embedding = await embed(chunk, baseUrl);
        if (embedding.length > 0) newChunks.push({ path: full, text: chunk, embedding, mtime });
      }
      if (newChunks.length > 0) chunkMap.set(full, newChunks);
    }
  };

  await walk(dir);
  saveIndex(indexPath, [...chunkMap.values()].flat());
}

export async function queryIndex(
  userText: string,
  baseUrl: string,
  indexPath = RAG_INDEX_FILE,
  topK = RAG_TOP_K,
  threshold = RAG_THRESHOLD,
): Promise<ScoredChunk[]> {
  const chunks = loadIndex(indexPath);
  if (chunks.length === 0) return [];
  const queryEmb = await embed(userText.slice(0, 1500), baseUrl);
  if (queryEmb.length === 0) return [];
  return chunks
    .map((c) => ({ path: c.path, text: c.text, score: cosineSimilarity(queryEmb, c.embedding) }))
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function buildContextBlock(chunks: ScoredChunk[]): string {
  if (chunks.length === 0) return "";
  const parts = ["## Relevant Code Context (RAG)"];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const key = `${chunk.path}:${chunk.text.slice(0, 50)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const lang = path.extname(chunk.path).slice(1);
    parts.push(`\n### ${chunk.path}\n\`\`\`${lang}\n${chunk.text}\n\`\`\``);
  }
  return parts.join("\n");
}
