/**
 * Telegram pairing stub — telegram support has been removed from ollama-cli.
 */
export function approvePairingCode(_code: string): { ok: boolean; userId: number; error: string } {
  return { ok: false, userId: 0, error: "Telegram not supported in ollama-cli" };
}

export function registerPairingCode(_userId: number): string {
  return "";
}
