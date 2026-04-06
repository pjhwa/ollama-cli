import { getOllamaBaseUrl } from "../discovery";

export const ULTRAPLAN_HEADER = "## ULTRAPLAN — Pre-computed Implementation Plan";
const ULTRAPLAN_MIN_LENGTH = 120;
const COMPLEX_PATTERN =
  /\b(?:implement|create|build|refactor|migrate|design|architect|optimize|add feature|add support|set up|configure|integrate|convert|replace)\b/i;

export function isComplexRequest(text: string): boolean {
  return text.length >= ULTRAPLAN_MIN_LENGTH && COMPLEX_PATTERN.test(text);
}

export function injectPlan(systemPrompt: string, plan: string): string {
  return `${systemPrompt}\n\n${ULTRAPLAN_HEADER}\n${plan}`;
}

async function callOllamaFast(prompt: string, modelId: string, baseUrl: string, maxTokens = 512): Promise<string> {
  const resp = await fetch(`${getOllamaBaseUrl(baseUrl)}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      options: { num_predict: maxTokens, temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!resp.ok) throw new Error(`Ollama error: ${resp.status}`);
  const data = (await resp.json()) as { message?: { content?: string } };
  return data.message?.content?.trim() ?? "";
}

export async function generatePlan(userText: string, modelId: string, baseUrl?: string): Promise<string> {
  const planPrompt =
    "You are a software architect. Analyze the following request and produce " +
    "a concise numbered implementation plan (5-10 steps). Output ONLY the plan, no preamble.\n\n" +
    "Request:\n" +
    userText.slice(0, 800);
  try {
    return await callOllamaFast(planPrompt, modelId, baseUrl ?? "", 512);
  } catch {
    return "";
  }
}
