/**
 * Telegram bridge stub — telegram support has been removed from ollama-cli.
 * This file exists only so the UI compiles without modification.
 */
import type { Agent } from "../agent/agent";
import type { ToolCall, ToolResult } from "../types/index";

export interface TelegramBridgeOptions {
  token: string;
  getApprovedUserIds: () => number[];
  coordinator: unknown;
  getTelegramAgent: (userId: number) => Agent;
  onUserMessage?: (event: { turnKey: string; userId: number; content: string }) => void;
  onAssistantMessage?: (event: { turnKey: string; userId: number; content: string; done: boolean }) => void;
  onToolCalls?: (event: { turnKey: string; userId: number; toolCalls: ToolCall[] }) => void;
  onToolResult?: (event: { turnKey: string; userId: number; toolCall: ToolCall; toolResult: ToolResult }) => void;
  onError?: (message: string) => void;
}

export interface TelegramBridgeHandle {
  start: () => void;
  stop: () => Promise<void>;
  sendDm: (userId: number, text: string) => Promise<void>;
}

export function createTelegramBridge(_options: TelegramBridgeOptions): TelegramBridgeHandle {
  return {
    start: () => {},
    stop: async () => {},
    sendDm: async (_userId: number, _text: string) => {},
  };
}
