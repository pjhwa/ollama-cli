const THINKING_MODEL_HINTS = ["qwen3", "deepseek-r1", "qwq", "marco-o1"] as const;

const COT_SUFFIX = "\n\nThink step-by-step before answering. Show your reasoning, then provide the final answer.";

export interface CoreMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | unknown;
}

export function isThinkingModelName(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return THINKING_MODEL_HINTS.some((hint) => lower.includes(hint));
}

export function forceCot(messages: CoreMessage[]): CoreMessage[] {
  const msgs = messages.map((m) => ({ ...m }));
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "user" && typeof msgs[i].content === "string") {
      const content = msgs[i].content as string;
      if (!content.includes("Think step-by-step")) {
        msgs[i] = { ...msgs[i], content: content + COT_SUFFIX };
      }
      break;
    }
  }
  return msgs;
}

export function applyThinkingMode(messages: CoreMessage[], modelId: string): CoreMessage[] {
  if (!isThinkingModelName(modelId)) return messages;
  const msgs = messages.map((m) => ({ ...m }));
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "user" && typeof msgs[i].content === "string") {
      const content = msgs[i].content as string;
      if (!content.startsWith("/think")) {
        msgs[i] = { ...msgs[i], content: "/think\n" + content };
      }
      break;
    }
  }
  return msgs;
}

export function stripThinkingTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
