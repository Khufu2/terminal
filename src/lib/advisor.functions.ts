import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const askAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string }) => {
    const prompt = String(input?.prompt ?? "").trim();
    if (!prompt) throw new Error("Ask a question first.");
    return { prompt: prompt.slice(0, 4000) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [holdings, accounts, signals, news, strategies, history] = await Promise.all([
      supabase.from("holdings").select("market, symbol, quantity, avg_cost, last_price"),
      supabase.from("accounts").select("market, label, balance_usd, target_weight"),
      supabase
        .from("signals")
        .select("market, symbol, direction, confidence, ai_reason")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("news_items")
        .select("title, sentiment, impact")
        .order("published_at", { ascending: false })
        .limit(8),
      supabase.from("strategies").select("name, risk_level, min_confidence, max_position_pct, is_active"),
      supabase
        .from("advisor_messages")
        .select("role, content")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    const priorTurns = (history.data ?? [])
      .slice()
      .reverse()
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

    const snapshot = JSON.stringify({
      holdings: holdings.data ?? [],
      accounts: accounts.data ?? [],
      signals: signals.data ?? [],
      news: news.data ?? [],
      strategies: strategies.data ?? [],
    });

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash",
        messages: [
          {
            role: "system",
            content: `You are Aurum, a calm, plain-spoken investing coach inside a personal trading terminal.
The user is a beginner. Explain jargon in one short clause when you use it.
Always ground answers in their actual portfolio snapshot below. Be concrete: name symbols, sizes, and risk.
Give position sizing in % of portfolio, always mention the downside case, and never promise returns.
Keep answers under 220 words, use short paragraphs or tight bullet lists. End with one clear next action.
This is a paper-trading terminal — frame execution as simulated.
PORTFOLIO SNAPSHOT: ${snapshot}`,
          },
          ...priorTurns,
          { role: "user", content: data.prompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limit reached — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Top up in Settings.");
    if (!res.ok) throw new Error(`Advisor unavailable (${res.status})`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim() || "I could not form an answer. Try rephrasing.";

    await supabase.from("advisor_messages").insert([
      { user_id: userId, role: "user", content: data.prompt },
      { user_id: userId, role: "assistant", content: reply },
    ]);

    return { reply };
  });
