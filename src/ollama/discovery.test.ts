import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOllamaBaseUrl,
  getOllamaChatBaseUrl,
  hasLocalOllama,
  listOllamaModels,
  type OllamaModelDescriptor,
} from "./discovery";

describe("getOllamaBaseUrl", () => {
  it("returns default when OLLAMA_BASE_URL is not set", () => {
    delete process.env.OLLAMA_BASE_URL;
    expect(getOllamaBaseUrl()).toBe("http://localhost:11434");
  });

  it("returns env var when set", () => {
    process.env.OLLAMA_BASE_URL = "http://192.168.1.10:11434";
    expect(getOllamaBaseUrl()).toBe("http://192.168.1.10:11434");
    delete process.env.OLLAMA_BASE_URL;
  });

  it("strips trailing slash", () => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434/";
    expect(getOllamaBaseUrl()).toBe("http://localhost:11434");
    delete process.env.OLLAMA_BASE_URL;
  });
});

describe("getOllamaChatBaseUrl", () => {
  it("appends /v1 to base url", () => {
    expect(getOllamaChatBaseUrl("http://localhost:11434")).toBe("http://localhost:11434/v1");
  });
});

describe("hasLocalOllama", () => {
  it("returns true when ollama responds 200", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true });
    expect(await hasLocalOllama()).toBe(true);
  });

  it("returns false when fetch throws", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await hasLocalOllama()).toBe(false);
  });

  it("returns false when response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false });
    expect(await hasLocalOllama()).toBe(false);
  });
});

describe("listOllamaModels", () => {
  it("returns model descriptors from /api/tags", async () => {
    const mockModels = [
      {
        name: "qwen2.5-coder:7b",
        details: { family: "qwen2", parameter_size: "7B", quantization_level: "Q4_K_M" },
        size: 4_000_000_000,
      },
      {
        name: "llama3.2:3b",
        details: { family: "llama", parameter_size: "3B", quantization_level: "Q8_0" },
        size: 2_000_000_000,
      },
    ];
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: mockModels }),
    });
    const result = await listOllamaModels();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject<OllamaModelDescriptor>({
      name: "qwen2.5-coder:7b",
      family: "qwen2",
      parameterSize: "7B",
      quantizationLevel: "Q4_K_M",
      sizeBytes: 4_000_000_000,
    });
  });

  it("returns empty array when ollama is not running", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await listOllamaModels()).toEqual([]);
  });
});
