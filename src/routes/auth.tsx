import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BrainCircuit, FlaskConical, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Terminal" },
      { name: "description", content: "AI market research, backtesting and paper trading in one clean terminal." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Account created. Check your email to confirm it, then sign in.");
          setMode("signin");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not authenticate");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.08fr_.92fr]">
      <section className="hidden border-r border-border p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-black">T</span>
          <span className="text-lg font-semibold tracking-[-0.035em]">Terminal</span>
        </div>
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Research before risk</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.06em]">A trading terminal that can show its work.</h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground">
            Research markets, run reproducible backtests and paper-trade from the same account. Live broker execution is not enabled by default.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Feature icon={BrainCircuit} title="AI research" body="Persistent research runs with evidence." />
            <Feature icon={FlaskConical} title="Backtests" body="Fees, drawdown and validation included." />
            <Feature icon={ShieldCheck} title="Paper first" body="No unrestricted live execution." />
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground">Terminal · Research and simulation software</div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-black">T</span><span className="text-lg font-semibold">Terminal</span></div>
          </div>
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.045em]">{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{mode === "signup" ? "Start with $100,000 of clearly labelled simulated buying power." : "Sign in to your Terminal workspace."}</p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
            <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></div>
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
              <span>{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</span><ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">or</span><div className="h-px flex-1 bg-border" /></div>
          <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => void google()}>Continue with Google</Button>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New to Terminal?"}{" "}
            <button type="button" className="font-semibold text-foreground hover:text-primary" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>{mode === "signup" ? "Sign in" : "Create one"}</button>
          </p>
          <p className="mt-6 text-center text-[10px] leading-5 text-muted-foreground">
            New accounts have simulated cash only. Terminal does not preload fake holdings, returns, news, signals or trade history.
          </p>
        </div>
      </section>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: typeof BrainCircuit; title: string; body: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4"><Icon className="h-4 w-4 text-primary" /><div className="mt-3 text-xs font-semibold">{title}</div><div className="mt-1 text-[10px] leading-4 text-muted-foreground">{body}</div></div>;
}
