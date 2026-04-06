import { describe, expect, it } from "vitest";
import { injectPlan, isComplexRequest, ULTRAPLAN_HEADER } from "./ultraplan";

describe("isComplexRequest", () => {
  it("returns true for implement requests over min length", () => {
    const text = "implement a full user authentication system with JWT tokens and refresh logic " + "a".repeat(60);
    expect(isComplexRequest(text)).toBe(true);
  });

  it("returns false for short messages", () => {
    expect(isComplexRequest("implement auth")).toBe(false);
  });

  it("returns false for simple questions without keywords", () => {
    const text = "what is the meaning of life? " + "a".repeat(100);
    expect(isComplexRequest(text)).toBe(false);
  });

  it("returns true for refactor keyword", () => {
    const text = "refactor the entire database layer to use a repository pattern " + "a".repeat(60);
    expect(isComplexRequest(text)).toBe(true);
  });
});

describe("injectPlan", () => {
  it("appends plan block to system prompt", () => {
    const result = injectPlan("You are a helper.", "1. Step one\n2. Step two");
    expect(result).toContain(ULTRAPLAN_HEADER);
    expect(result).toContain("1. Step one");
    expect(result).toContain("You are a helper.");
  });
});
