type GeminiOptions = {
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export function isGeminiConfigured() {
  return Boolean(
    process.env["GEMINI_API_KEY"] ||
    process.env["GOOGLE_GENERATIVE_AI_API_KEY"] ||
    process.env["GOOGLE_API_KEY"],
  );
}

export async function geminiGenerate(prompt: string, options: GeminiOptions = {}) {
  const apiKey =
    process.env["GEMINI_API_KEY"] ||
    process.env["GOOGLE_GENERATIVE_AI_API_KEY"] ||
    process.env["GOOGLE_API_KEY"];
  if (!apiKey) throw new Error("Gemini is not configured.");

  const model = process.env["GEMINI_MODEL"] || "gemini-2.5-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(options.system
            ? { systemInstruction: { parts: [{ text: options.system }] } }
            : {}),
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0.25,
            maxOutputTokens: options.maxOutputTokens ?? 3000,
          },
        }),
      },
    );
    const text = await res.text();
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
    const json = JSON.parse(text) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const answer = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!answer) throw new Error("Gemini returned no usable response.");
    return answer;
  } finally {
    clearTimeout(timeout);
  }
}
