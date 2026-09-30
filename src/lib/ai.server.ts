import { geminiGenerate, isGeminiConfigured } from "@/lib/gemini.server";
import {
  getOpenRouterModel,
  isOpenRouterConfigured,
  openRouterGenerate,
} from "@/lib/openrouter.server";

export type AIProvider = "gemini" | "openrouter";

export type AIGenerateOptions = {
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export function getAIProviderStatus() {
  return {
    gemini: isGeminiConfigured(),
    openrouter: isOpenRouterConfigured(),
    openrouterModel: isOpenRouterConfigured() ? getOpenRouterModel() : null,
    primary: isGeminiConfigured()
      ? ("gemini" as const)
      : isOpenRouterConfigured()
        ? ("openrouter" as const)
        : null,
  };
}

export function isFastAIConfigured() {
  return isGeminiConfigured() || isOpenRouterConfigured();
}

/**
 * Terminal's server-side provider chain.
 * Gemini is always attempted first. OpenRouter is used only when Gemini is
 * absent or the request fails. Provider errors are never returned to the
 * browser with secrets attached.
 */
export async function generateWithFallback(
  prompt: string,
  options: AIGenerateOptions = {},
): Promise<{
  text: string;
  provider: AIProvider;
  model: string;
  fallbackUsed: boolean;
}> {
  const failures: string[] = [];

  if (isGeminiConfigured()) {
    try {
      const text = await geminiGenerate(prompt, options);
      return {
        text,
        provider: "gemini",
        model: process.env["GEMINI_MODEL"] || "gemini-2.5-flash",
        fallbackUsed: false,
      };
    } catch (error) {
      failures.push(
        `Gemini: ${error instanceof Error ? error.message.slice(0, 180) : "request failed"}`,
      );
    }
  }

  if (isOpenRouterConfigured()) {
    try {
      const result = await openRouterGenerate(prompt, options);
      return {
        text: result.text,
        provider: "openrouter",
        model: result.model,
        fallbackUsed: isGeminiConfigured(),
      };
    } catch (error) {
      failures.push(
        `OpenRouter: ${error instanceof Error ? error.message.slice(0, 180) : "request failed"}`,
      );
    }
  }

  if (!isGeminiConfigured() && !isOpenRouterConfigured()) {
    throw new Error(
      "AI is not configured. Add GEMINI_API_KEY and/or OPENROUTER_API_KEY in Vercel.",
    );
  }

  throw new Error(
    `Terminal AI providers are temporarily unavailable. ${failures.join(" | ")}`,
  );
}
