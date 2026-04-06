import { describe, expect, it } from "vitest";
import type { OllamaModelDescriptor } from "./discovery";
import { isViableOllamaChatModel, recommendModel, scoreModel } from "./models";

const MODELS: OllamaModelDescriptor[] = [
  {
    name: "qwen2.5-coder:7b",
    sizeBytes: 4_500_000_000,
    family: "qwen2",
    parameterSize: "7B",
    quantizationLevel: "Q4_K_M",
  },
  { name: "llama3.2:3b", sizeBytes: 2_000_000_000, family: "llama", parameterSize: "3B", quantizationLevel: "Q8_0" },
  { name: "nomic-embed-text", sizeBytes: 300_000_000, family: null, parameterSize: null, quantizationLevel: null },
  {
    name: "deepseek-coder:6.7b",
    sizeBytes: 3_800_000_000,
    family: null,
    parameterSize: "6.7B",
    quantizationLevel: "Q4_0",
  },
];

describe("isViableOllamaChatModel", () => {
  it("filters out embedding models", () => {
    expect(
      isViableOllamaChatModel({
        name: "nomic-embed-text",
        sizeBytes: null,
        family: null,
        parameterSize: null,
        quantizationLevel: null,
      }),
    ).toBe(false);
  });

  it("allows chat models", () => {
    expect(isViableOllamaChatModel(MODELS[0])).toBe(true);
    expect(isViableOllamaChatModel(MODELS[1])).toBe(true);
  });
});

describe("scoreModel", () => {
  it("scores coding models higher for coding goal", () => {
    const coderScore = scoreModel(MODELS[0], "coding").score;
    const llamaScore = scoreModel(MODELS[1], "coding").score;
    expect(coderScore).toBeGreaterThan(llamaScore);
  });

  it("scores small models higher for latency goal", () => {
    const smallScore = scoreModel(MODELS[1], "latency").score; // 3B
    const largeScore = scoreModel(MODELS[0], "latency").score; // 7B
    expect(smallScore).toBeGreaterThan(largeScore);
  });
});

describe("recommendModel", () => {
  it("recommends a coding model for coding goal", () => {
    const result = recommendModel(MODELS, "coding");
    expect(result?.name).toMatch(/coder/i);
  });

  it("recommends a small model for latency goal", () => {
    const result = recommendModel(MODELS, "latency");
    expect(result?.name).toContain("3b");
  });

  it("returns null when no viable models", () => {
    expect(recommendModel([], "balanced")).toBeNull();
  });
});
