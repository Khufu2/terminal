/** Server-only gateway for the isolated Vibe-Trading engine. */

export type EngineSession = {
  session_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_attempt_id?: string | null;
};

export type EngineMessage = {
  message_id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
  linked_attempt_id?: string | null;
  metadata?: Record<string, unknown> | null;
  tool_trail?: Record<string, unknown>[];
};

export function isQuantEngineConfigured() {
  return Boolean(process.env["QUANT_ENGINE_URL"] && process.env["QUANT_ENGINE_API_KEY"]);
}

function config() {
  const baseUrl = (process.env["QUANT_ENGINE_URL"] ?? "").replace(/\/$/, "");
  const apiKey = process.env["QUANT_ENGINE_API_KEY"] ?? "";
  if (!baseUrl) throw new Error("Quant engine is not configured. Set QUANT_ENGINE_URL.");
  if (!apiKey) throw new Error("Quant engine is not configured. Set QUANT_ENGINE_API_KEY.");
  return { baseUrl, apiKey };
}

export async function quantEngineRequest<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 20_000,
): Promise<T> {
  const { baseUrl, apiKey } = config();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Quant engine ${response.status}: ${text.slice(0, 500)}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  } finally {
    clearTimeout(timeout);
  }
}
