type OpenRouterOptions = {
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export function isOpenRouterConfigured() {
  return Boolean(process.env["OPENROUTER_API_KEY"]);
}

export function getOpenRouterModel() {
  return (
    process.env["OPENROUTER_MODEL_ROUTER"] ||
    process.env["OPENROUTER_MODEL"] ||
    "openrouter/auto"
  );
}

function extractContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

export async function openRouterGenerate(
  prompt: string,
  options: OpenRouterOptions = {},
) {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OpenRouter is not configured.");

  const model = getOpenRouterModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const headers: Record<string, string> = {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
      "x-title": "Terminal",
    };

    const productionUrl = process.env["VERCEL_PROJECT_PRODUCTION_URL"];
    if (productionUrl) headers["http-referer"] = `https://${productionUrl}`;

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (options.system) messages.push({ role: "system", content: options.system });
    messages.push({ role: "user", content: prompt });

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.25,
        max_tokens: options.maxOutputTokens ?? 3000,
      }),
    });

    const body = await res.text();
    if (!res.ok) {
      throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = JSON.parse(body) as {
      model?: string;
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const answer = extractContent(json.choices?.[0]?.message?.content);
    if (!answer) throw new Error("OpenRouter returned no usable response.");

    return {
      text: answer,
      model: json.model || model,
    };
  } finally {
    clearTimeout(timeout);
  }
}
