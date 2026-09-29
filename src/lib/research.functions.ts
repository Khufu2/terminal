import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  quantEngineRequest,
  type EngineMessage,
  type EngineSession,
} from "@/lib/quant-engine.server";

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
