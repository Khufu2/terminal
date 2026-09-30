import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  isQuantEngineConfigured,
  quantEngineRequest,
  type EngineMessage,
  type EngineSession,
} from "@/lib/quant-engine.server";
import { geminiGenerate, isGeminiConfigured } from "@/lib/gemini.server";

const cleanPrompt = (value: unknown) => {
  const prompt = String(value ?? "").trim();
  if (!prompt) throw new Error("Describe what you want Terminal to research.");
  return prompt.slice(0, 5000);
};

export const startResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string }) => ({ prompt: cleanPrompt(input?.prompt) }))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const session = await quantEngineRequest<EngineSession>("/sessions", {
      method: "POST",
      body: JSON.stringify({
        title: data.prompt.slice(0, 72),
        config: { terminal_user_id: context.userId, mode: "research" },
      }),
    });

    const { data: row, error } = await db
      .from("research_runs")
      .insert({
        user_id: context.userId,
        engine_session_id: session.session_id,
        prompt: data.prompt,
        status: "starting",
      })
      .select("id, engine_session_id, prompt, status, created_at")
      .single();
    if (error) throw new Error(error.message);

    try {
      await quantEngineRequest(`/sessions/${session.session_id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: data.prompt }),
      });
      await db.from("research_runs").update({ status: "running" }).eq("id", row.id);
      return { ...row, status: "running" as const };
    } catch (err) {
      await db.from("research_runs").update({ status: "failed" }).eq("id", row.id);
      throw err;
    }
  });

export const listResearchRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data, error } = await db
      .from("research_runs")
      .select("id, engine_session_id, prompt, status, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getResearchRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => ({ runId: String(input?.runId ?? "") }))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: row, error } = await db
      .from("research_runs")
      .select("id, engine_session_id, prompt, status, created_at, updated_at")
      .eq("id", data.runId)
      .eq("user_id", context.userId)
      .single();
    if (error || !row) throw new Error("Research run not found.");

    const [session, messages] = await Promise.all([
      quantEngineRequest<EngineSession>(`/sessions/${row.engine_session_id}`),
      quantEngineRequest<EngineMessage[]>(`/sessions/${row.engine_session_id}/messages?limit=200`),
    ]);
    const status = session.status || row.status;
    if (status !== row.status) {
      await db.from("research_runs").update({ status }).eq("id", row.id);
    }
    return { ...row, status, session, messages };
  });

export const cancelResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => ({ runId: String(input?.runId ?? "") }))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: row, error } = await db
      .from("research_runs")
      .select("id, engine_session_id")
      .eq("id", data.runId)
      .eq("user_id", context.userId)
      .single();
    if (error || !row) throw new Error("Research run not found.");
    await quantEngineRequest(`/sessions/${row.engine_session_id}/cancel`, { method: "POST" });
    await db.from("research_runs").update({ status: "cancelled" }).eq("id", row.id);
    return { ok: true };
  });


export const getResearchCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    vibe: isQuantEngineConfigured(),
    gemini: isGeminiConfigured(),
  }));

export const askGeminiResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string }) => ({ prompt: cleanPrompt(input?.prompt) }))
  .handler(async ({ data, context }) => {
    if (!isGeminiConfigured()) throw new Error("Gemini is not configured.");

    const db = context.supabase as any;
    const [holdings, accounts, signals, news] = await Promise.all([
      db.from("holdings").select("market, symbol, name, quantity, avg_cost, last_price").eq("user_id", context.userId),
      db.from("accounts").select("market, label, balance_usd, equity_usd").eq("user_id", context.userId),
      db.from("signals").select("market, symbol, direction, confidence, ai_reason, created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(12),
      db.from("news_items").select("source, title, summary, symbols, published_at").eq("user_id", context.userId).order("published_at", { ascending: false }).limit(12),
    ]);

    const snapshot = {
      holdings: holdings.data ?? [],
      accounts: accounts.data ?? [],
      signals: signals.data ?? [],
      news: news.data ?? [],
    };

    const reply = await geminiGenerate(
      `User question: ${data.prompt}

Terminal account context:
${JSON.stringify(snapshot)}`,
      {
        system: `You are Terminal Research, a rigorous market research assistant.
Use the supplied account context when relevant. Do not invent current prices, backtest statistics, filings, news, or sources.
If a claim needs live/current evidence that is not present, say what data is missing.
Separate: observations, hypotheses, risks, and what to test next.
Never present a strategy as guaranteed or turn analysis into an automatic live order.
Keep the answer concise but analytical.`,
        temperature: 0.2,
        maxOutputTokens: 2200,
      },
    );

    return {
      provider: "gemini" as const,
      reply,
      createdAt: new Date().toISOString(),
    };
  });
