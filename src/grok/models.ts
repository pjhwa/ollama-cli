/**
 * Compatibility stub — replaced by ollama/models.ts in ollama-cli.
 * This file exists only so the UI compiles without modifications.
 * Ollama does not have a static model registry; models are discovered at runtime.
 */
import type { ModelInfo, ReasoningEffort } from "../types/index";

export const MODELS: ModelInfo[] = [];

export const DEFAULT_MODEL = "llama3.2";

export function getModelIds(): string[] {
  return [];
}

export function getModelInfo(_modelId: string): ModelInfo | null {
  return null;
}

export function normalizeModelId(modelId: string): string {
  return modelId.trim();
}

export function getEffectiveReasoningEffort(
  _modelId: string,
  _effort: ReasoningEffort | undefined,
): ReasoningEffort | undefined {
  return undefined;
}

export function getSupportedReasoningEfforts(_modelId: string): ReasoningEffort[] {
  return [];
}
