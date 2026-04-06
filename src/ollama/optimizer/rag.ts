import * as fs from "fs";
import * as path from "path";

export const RAG_INDEX_FILE = ".rag-index.json";

export interface CodeChunk {
  path: string;
  text: string;
  score: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  const dotProduct = a.reduce((sum, av, i) => sum + av * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, av) => sum + av * av, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, bv) => sum + bv * bv, 0));
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

export function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  if (text.length <= chunkSize) {
    return [text];
  }
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

export function buildContextBlock(chunks: CodeChunk[]): string {
  if (chunks.length === 0) return "";
  let block = "## Relevant Code Context (RAG)\n";
  for (const chunk of chunks) {
    block += `\n### ${chunk.path} (relevance: ${(chunk.score * 100).toFixed(0)}%)\n`;
    block += "```\n" + chunk.text + "\n```\n";
  }
  return block;
}

export interface RAGIndex {
  chunks: Array<{ path: string; text: string; embedding: number[] }>;
}

async function simpleEmbedding(text: string): Promise<number[]> {
  const words = text.toLowerCase().split(/\s+/);
  const vec: Record<string, number> = {};
  for (const word of words) {
    vec[word] = (vec[word] || 0) + 1;
  }
  return Object.values(vec).slice(0, 384);
}

export function loadIndex(indexPath?: string): Array<{ path: string; text: string; embedding: number[] }> {
  const file = indexPath ?? RAG_INDEX_FILE;
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8")) as RAGIndex;
    return data.chunks ?? [];
  } catch {
    return [];
  }
}

export async function indexDirectory(rootDir: string, baseUrl?: string): Promise<void> {
  const chunks: Array<{ path: string; text: string; embedding: number[] }> = [];
  const tsFiles = findFiles(rootDir, ".ts");
  for (const file of tsFiles) {
    const text = fs.readFileSync(file, "utf-8");
    const textChunks = chunkText(text, 500, 50);
    for (const chunk of textChunks) {
      const embedding = await simpleEmbedding(chunk);
      chunks.push({ path: file, text: chunk, embedding });
    }
  }
  const index: RAGIndex = { chunks };
  fs.writeFileSync(RAG_INDEX_FILE, JSON.stringify(index, null, 2));
}

function findFiles(dir: string, ext: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...findFiles(fullPath, ext));
      }
    } else if (entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function queryIndex(query: string, baseUrl?: string): Promise<CodeChunk[]> {
  if (!fs.existsSync(RAG_INDEX_FILE)) return [];
  const indexData = JSON.parse(fs.readFileSync(RAG_INDEX_FILE, "utf-8")) as RAGIndex;
  const queryEmbedding = await simpleEmbedding(query);
  const scored = indexData.chunks.map((chunk) => ({
    path: chunk.path,
    text: chunk.text,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, 5);
}
