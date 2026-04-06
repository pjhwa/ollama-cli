import { describe, expect, it } from "vitest";
import { applyThinkingMode, forceCot, isThinkingModelName, stripThinkingTags } from "./cot";

const msgs = (content: string) => [{ role: "user" as const, content }];

describe("isThinkingModelName", () => {
  it("detects qwen3", () => expect(isThinkingModelName("qwen3:14b")).toBe(true));
  it("detects deepseek-r1", () => expect(isThinkingModelName("deepseek-r1:8b")).toBe(true));
  it("returns false for llama", () => expect(isThinkingModelName("llama3.2:3b")).toBe(false));
});

describe("forceCot", () => {
  it("appends CoT suffix to last user message", () => {
    const result = forceCot(msgs("fix this bug"));
    expect(result[0].content).toContain("Think step-by-step");
    expect(result[0].content).toContain("fix this bug");
  });

  it("does not add CoT if already present", () => {
    const already = msgs("fix this bug\n\nThink step-by-step before answering.");
    const result = forceCot(already);
    const count = (result[0].content.match(/Think step-by-step/g) || []).length;
    expect(count).toBe(1);
  });
});

describe("applyThinkingMode", () => {
  it("prepends /think to last user message for thinking models", () => {
    const result = applyThinkingMode(msgs("implement auth"), "qwen3:14b");
    expect(result[0].content).toMatch(/^\/think\n/);
  });

  it("does nothing for non-thinking models", () => {
    const result = applyThinkingMode(msgs("implement auth"), "llama3.2:3b");
    expect(result[0].content).toBe("implement auth");
  });

  it("does not double-prepend", () => {
    const already = msgs("/think\nimplement auth");
    const result = applyThinkingMode(already, "qwen3:14b");
    expect(result[0].content).toMatch(/^\/think\n/);
    expect(result[0].content.split("/think").length - 1).toBe(1);
  });
});

describe("stripThinkingTags", () => {
  it("removes <think>...</think> blocks", () => {
    const input = "<think>\nsome internal reasoning\n</think>\nFinal answer here.";
    expect(stripThinkingTags(input)).toBe("Final answer here.");
  });

  it("handles multiple think blocks", () => {
    const input = "<think>A</think>text<think>B</think>end";
    expect(stripThinkingTags(input)).toBe("textend");
  });

  it("passes through text without think tags", () => {
    expect(stripThinkingTags("plain text")).toBe("plain text");
  });
});
