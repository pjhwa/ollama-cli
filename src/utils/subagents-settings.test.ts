import { describe, expect, it } from "vitest";
import { parseSubAgentsRawList } from "./settings";

describe("parseSubAgentsRawList", () => {
  it("returns empty for non-array or missing", () => {
    expect(parseSubAgentsRawList(undefined)).toEqual([]);
    expect(parseSubAgentsRawList(null)).toEqual([]);
    expect(parseSubAgentsRawList({})).toEqual([]);
  });

  it("keeps valid entries with any model id", () => {
    expect(
      parseSubAgentsRawList([{ name: "docs", model: "llama3.2:8b", instruction: "Focus on documentation." }]),
    ).toEqual([{ name: "docs", model: "llama3.2:8b", instruction: "Focus on documentation." }]);
  });

  it("accepts any model string including custom ollama models", () => {
    expect(
      parseSubAgentsRawList([{ name: "research", model: "mistral:7b", instruction: "Focus on research." }]),
    ).toEqual([{ name: "research", model: "mistral:7b", instruction: "Focus on research." }]);
  });

  it("skips entries with missing name or model", () => {
    expect(parseSubAgentsRawList([{ name: "", model: "llama3.2", instruction: "x" }])).toEqual([]);
    expect(parseSubAgentsRawList([{ name: "ok", model: "", instruction: "x" }])).toEqual([]);
    expect(parseSubAgentsRawList([{ name: "  ", model: "llama3.2", instruction: "x" }])).toEqual([]);
  });

  it("dedupes by case-insensitive name with first entry winning", () => {
    expect(
      parseSubAgentsRawList([
        { name: "Docs", model: "llama3.2", instruction: "first" },
        { name: "docs", model: "mistral", instruction: "second" },
      ]),
    ).toEqual([{ name: "Docs", model: "llama3.2", instruction: "first" }]);
  });

  it("ignores non-object rows", () => {
    expect(parseSubAgentsRawList([null, "x", { name: "ok", model: "qwen3:8b", instruction: "" }])).toEqual([
      { name: "ok", model: "qwen3:8b", instruction: "" },
    ]);
  });
});
