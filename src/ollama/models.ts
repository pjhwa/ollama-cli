import type { OllamaModelDescriptor } from "./discovery";

export type RecommendationGoal = "latency" | "balanced" | "coding";

export interface RankedOllamaModel extends OllamaModelDescriptor {
  score: number;
  reasons: string[];
}

const CODING_HINTS = [
  "coder",
  "codellama",
  "codegemma",
  "codestral",
  "devstral",
  "starcoder",
  "deepseek-coder",
  "qwen2.5-coder",
  "qwen-coder",
];
const NON_CHAT_HINTS = ["embed", "embedding", "rerank", "bge", "whisper"];

function modelHaystack(m: OllamaModelDescriptor): string {
  return [m.name, m.family ?? "", m.parameterSize ?? "", m.quantizationLevel ?? ""].join(" ").toLowerCase();
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}

export function isViableOllamaChatModel(m: OllamaModelDescriptor): boolean {
  return !includesAny(modelHaystack(m), NON_CHAT_HINTS);
}

function inferParamsBillions(m: OllamaModelDescriptor): number | null {
  const text = `${m.parameterSize ?? ""} ${m.name}`.toLowerCase();
  const match = text.match(/(\d+(?:\.\d+)?)\s*b\b/);
  if (match?.[1]) return Number(match[1]);
  if (typeof m.sizeBytes === "number" && m.sizeBytes > 0) {
    return Number((m.sizeBytes / 1_000_000_000).toFixed(1));
  }
  return null;
}

export function scoreModel(m: OllamaModelDescriptor, goal: RecommendationGoal): RankedOllamaModel {
  const reasons: string[] = [];
  let score = 0;
  const hay = modelHaystack(m);
  const paramsB = inferParamsBillions(m);

  // Coding bonus
  if (includesAny(hay, CODING_HINTS)) {
    const bonus = goal === "coding" ? 30 : goal === "balanced" ? 15 : 5;
    score += bonus;
    reasons.push(`coding model (+${bonus})`);
  }

  // Size score
  if (paramsB !== null) {
    if (goal === "latency") {
      if (paramsB <= 4) {
        score += 25;
        reasons.push("tiny model for latency");
      } else if (paramsB <= 8) {
        score += 15;
        reasons.push("small model");
      } else if (paramsB <= 14) {
        score += 5;
        reasons.push("mid model");
      } else {
        score -= 10;
        reasons.push("large model (slow)");
      }
    } else if (goal === "coding") {
      if (paramsB <= 4) {
        score += 5;
        reasons.push("tiny (may lack quality)");
      } else if (paramsB <= 8) {
        score += 20;
        reasons.push("good coding size");
      } else if (paramsB <= 14) {
        score += 25;
        reasons.push("strong coding size");
      } else {
        score += 15;
        reasons.push("large model");
      }
    } else {
      if (paramsB <= 4) {
        score += 10;
      } else if (paramsB <= 8) {
        score += 20;
        reasons.push("balanced size");
      } else if (paramsB <= 14) {
        score += 18;
      } else {
        score += 10;
      }
    }
  }

  return { ...m, score, reasons };
}

export function recommendModel(
  models: OllamaModelDescriptor[],
  goal: RecommendationGoal = "balanced",
): OllamaModelDescriptor | null {
  const viable = models.filter(isViableOllamaChatModel);
  if (viable.length === 0) return null;
  const ranked = viable.map((m) => scoreModel(m, goal)).sort((a, b) => b.score - a.score);
  return ranked[0] ?? null;
}
