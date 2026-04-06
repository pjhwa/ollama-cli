import { describe, expect, it, vi } from "vitest";
import { pullModel } from "./pull";

describe("pullModel", () => {
  it("calls onProgress with status updates", async () => {
    const lines = [
      JSON.stringify({ status: "pulling manifest" }),
      JSON.stringify({ status: "downloading", completed: 500, total: 1000 }),
      JSON.stringify({ status: "success" }),
    ];
    const encoder = new TextEncoder();
    let i = 0;
    const body = {
      getReader: () => ({
        read: async () => {
          if (i >= lines.length) return { done: true, value: undefined };
          const value = encoder.encode(lines[i++] + "\n");
          return { done: false, value };
        },
      }),
    };
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, body });

    const progress: string[] = [];
    await pullModel("qwen2.5-coder:7b", (p) => progress.push(p.status));

    expect(progress).toContain("pulling manifest");
    expect(progress).toContain("success");
  });

  it("throws when ollama returns error status", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(pullModel("no-model")).rejects.toThrow("Pull failed");
  });

  it("throws when fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(pullModel("no-model")).rejects.toThrow("ECONNREFUSED");
  });
});
