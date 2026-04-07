import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getOllamaChatBaseUrl } from "./discovery";

export type OllamaProvider = ReturnType<typeof createOpenAI>;
export type OllamaModel = ReturnType<OllamaProvider>;

export const THINKING_MODELS = ["qwen3", "deepseek-r1", "qwq", "marco-o1"] as const;

export interface OllamaModelRuntime {
  model: OllamaModel;
  modelId: string;
  isThinkingModel: boolean;
}

export interface GeneratedTitle {
  title: string;
  modelId: string;
  usage?: Record<string, unknown>;
}

export function isThinkingModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return THINKING_MODELS.some((tm) => lower.includes(tm));
}

export function createProvider(baseUrl?: string): OllamaProvider {
  return createOpenAI({
    baseURL: getOllamaChatBaseUrl(baseUrl),
    apiKey: "ollama",
    compatibility: "compatible",
  });
}

export function resolveModelRuntime(provider: OllamaProvider, modelId: string): OllamaModelRuntime {
  return {
    model: provider(modelId),
    modelId,
    isThinkingModel: isThinkingModel(modelId),
  };
}

export async function generateTitle(
  provider: OllamaProvider,
  userMessage: string,
  modelId: string,
): Promise<GeneratedTitle> {
  try {
    const { text, usage } = await generateText({
      // biome-ignore lint/suspicious/noExplicitAny: Ollama SDK returns LanguageModelV1, cast required
      model: provider(modelId) as any,
      temperature: 0.5,
      maxOutputTokens: 60,
      system: [
        "You are a title generator. Output ONLY a short title. Nothing else.",
        "Rules:",
        "- Single line, ≤50 characters",
        "- Focus on the main topic or intent",
        "- Never use tools or explain anything",
      ].join("\n"),
      prompt: userMessage,
    });
    return {
      title: text?.trim().replace(/^["']|["']$/g, "") || "New session",
      modelId,
      usage,
    };
  } catch {
    return { title: "New session", modelId };
  }
}
