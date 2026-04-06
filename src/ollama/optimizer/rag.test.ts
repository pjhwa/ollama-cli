import { describe, expect, it } from "vitest";
import { buildContextBlock, chunkText, cosineSimilarity } from "./rag";

describe("cosineSimilarity", () => {
  it("returns 1.0 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1.0);
  });

  it("returns 0.0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
  });

  it("returns 0.0 for zero vectors", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe("chunkText", () => {
  it("splits text into overlapping chunks", () => {
    const text = "a".repeat(1200);
    const chunks = chunkText(text, 500, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBe(500);
  });

  it("returns single chunk for short text", () => {
    expect(chunkText("short", 500, 100)).toEqual(["short"]);
  });
});

describe("buildContextBlock", () => {
  it("builds formatted context block from chunks", () => {
    const chunks = [{ path: "src/foo.ts", text: "function foo() {}", score: 0.8 }];
    const result = buildContextBlock(chunks);
    expect(result).toContain("## Relevant Code Context (RAG)");
    expect(result).toContain("src/foo.ts");
    expect(result).toContain("function foo() {}");
  });

  it("returns empty string for empty chunks", () => {
    expect(buildContextBlock([])).toBe("");
  });
});
