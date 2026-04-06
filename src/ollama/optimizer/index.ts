import * as fs from "fs";
import { getOptimizerSettings } from "../../utils/settings";
import { getOllamaBaseUrl } from "../discovery";
import { applyThinkingMode, type CoreMessage, forceCot, stripThinkingTags } from "./cot";
import { buildContextBlock, queryIndex, RAG_INDEX_FILE } from "./rag";
import { generatePlan, injectPlan, isComplexRequest } from "./ultraplan";

export interface OptimizerInput {
  messages: CoreMessage[];
  systemPrompt: string;
  modelId: string;
  baseUrl?: string;
}

export interface OptimizerOutput {
  messages: CoreMessage[];
  systemPrompt: string;
}

function extractLastUserText(messages: CoreMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user" && typeof messages[i].content === "string") {
      return messages[i].content as string;
    }
  }
  return "";
}

export async function runOptimizerPipeline(input: OptimizerInput): Promise<OptimizerOutput> {
  if (process.env.OLLAMA_CLI_NO_OPTIMIZER) {
    return { messages: input.messages, systemPrompt: input.systemPrompt };
  }

  const cfg = getOptimizerSettings();
  let { messages, systemPrompt, modelId, baseUrl } = input;
  const resolvedBaseUrl = getOllamaBaseUrl(baseUrl);
  const userText = extractLastUserText(messages);

  // [1] RAG — inject relevant code context
  if (cfg.enableRag && fs.existsSync(RAG_INDEX_FILE)) {
    const chunks = await queryIndex(userText, resolvedBaseUrl);
    const ctx = buildContextBlock(chunks);
    if (ctx) systemPrompt = `${systemPrompt}\n\n${ctx}`;
  }

  // [2] UltraPlan — pre-generate plan for complex requests
  if (cfg.enableUltraPlan && isComplexRequest(userText)) {
    const plan = await generatePlan(userText, modelId, resolvedBaseUrl);
    if (plan) systemPrompt = injectPlan(systemPrompt, plan);
  }

  // [3] CoT — force chain-of-thought
  if (cfg.enableCoT) {
    messages = forceCot(messages);
  }

  // [4] Thinking mode — for models that support it
  if (cfg.enableThinking) {
    messages = applyThinkingMode(messages, modelId);
  }

  return { messages, systemPrompt };
}

export { stripThinkingTags };
