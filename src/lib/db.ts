import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export type Account = {
  id: string;
  market: string;
  label: string;
  mode: string;
  balance_usd: number;
  equity_usd: number;
  target_weight: number;
};
export type Holding = {
  id: string;
  market: string;
  symbol: string;
  name: string | null;
  quantity: number;
  avg_cost: number;
  last_price: number;
};
export type Transaction = {
  id: string;
  market: string;
  symbol: string;
  side: string;
  order_type: string;
  quantity: number;
  price: number;
  fees: number;
  stop_price: number | null;
  target_price: number | null;
  status: string;
  mode: string;
  notes: string | null;
  executed_at: string;
};
export type FinanceEntry = {
  id: string;
  kind: string;
  category: string;
  label: string;
  amount: number;
  recurring: boolean;
  entry_date: string;
};
export type Signal = {
  id: string;
  market: string;
  symbol: string;
  direction: string;
  confidence: number;
  sentiment: number;
  source: string;
  ai_reason: string | null;
  entry_price: number | null;
  target_price: number | null;
  stop_price: number | null;
  created_at: string;
};
export type NewsItem = {
  id: string;
  source: string;
  title: string;
  summary: string | null;
  url: string | null;
  symbols: string | null;
  sentiment: number;
  impact: string;
  published_at: string;
};
export type Strategy = {
  id: string;
  name: string;
  description: string | null;
  risk_level: string;
  crypto_weight: number;
  stocks_weight: number;
  kalshi_weight: number;
  min_confidence: number;
  max_position_pct: number;
  is_active: boolean;
};
export type Trader = {
  id: string;
  name: string;
  handle: string | null;
  market: string;
  specialty: string | null;
  win_rate: number;
  ytd_return: number;
  current_stance: string | null;
  following: boolean;
};
export type JournalEntry = {
  id: string;
  symbol: string | null;
  market: string | null;
  title: string;
  body: string | null;
  tags: string | null;
  outcome: string | null;
  r_multiple: number | null;
  entry_date: string;
};
export type Connection = {
  id: string;
  provider: string;
  category: string;
  status: string;
  notes: string | null;
};
export type WatchItem = { id: string; market: string; symbol: string; name: string | null };
export type Snapshot = { market: string; equity_usd: number; snapshot_at: string };
export type AdvisorMessage = { id: string; role: string; content: string; created_at: string };

export type RiskSettings = {
  id: string;
  autonomy_enabled: boolean;
  halted: boolean;
  halt_reason: string | null;
  risk_per_trade_pct: number;
  max_open_positions: number;
  max_market_exposure_pct: number;
  daily_loss_limit_pct: number;
  max_drawdown_pct: number;
  min_confidence: number;
  live_crypto: boolean;
  live_stocks: boolean;
  live_kalshi: boolean;
  telegram_chat_id: string | null;
  day_start_equity: number;
  peak_equity: number;
};
export type BotDecision = {
  id: string;
  market: string;
  symbol: string;
  action: string;
  confidence: number;
  quantity: number | null;
  price: number | null;
  reason: string | null;
  accepted: boolean;
  blocked_reason: string | null;
  created_at: string;
};
export type BotRun = { id: string; job: string; status: string; detail: string | null; created_at: string };
export type Alert = { id: string; level: string; title: string; body: string | null; delivered: boolean; created_at: string };

export const useRiskSettings = () =>
  useQuery({
    queryKey: ["risk_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("risk_settings").select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as RiskSettings | null;
    },
  });

export const useBotDecisions = (limit = 30) =>
  useQuery({
    queryKey: ["bot_decisions", limit],
    queryFn: () =>
      unwrap<BotDecision[]>(
        supabase.from("bot_decisions").select("*").order("created_at", { ascending: false }).limit(limit),
      ),
  });

export const useBotRuns = (limit = 20) =>
  useQuery({
    queryKey: ["bot_runs", limit],
    queryFn: () =>
      unwrap<BotRun[]>(supabase.from("bot_runs").select("*").order("created_at", { ascending: false }).limit(limit)),
  });

export const useAlerts = (limit = 20) =>
  useQuery({
    queryKey: ["alerts"],
    queryFn: () =>
      unwrap<Alert[]>(supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(limit)),
  });

export const useAccounts = () =>
  useQuery({
    queryKey: ["accounts"],
    queryFn: () => unwrap<Account[]>(supabase.from("accounts").select("*").order("market")),
  });

export const useHoldings = () =>
  useQuery({
    queryKey: ["holdings"],
    queryFn: () => unwrap<Holding[]>(supabase.from("holdings").select("*").order("market")),
  });

export const useTransactions = (limit = 100) =>
  useQuery({
    queryKey: ["transactions", limit],
    queryFn: () =>
      unwrap<Transaction[]>(
        supabase.from("transactions").select("*").order("executed_at", { ascending: false }).limit(limit),
      ),
  });

export const useFinanceEntries = () =>
  useQuery({
    queryKey: ["finance_entries"],
    queryFn: () =>
      unwrap<FinanceEntry[]>(
        supabase.from("finance_entries").select("*").order("entry_date", { ascending: false }),
      ),
  });

export const useSignals = (limit = 50) =>
  useQuery({
    queryKey: ["signals", limit],
    queryFn: () =>
      unwrap<Signal[]>(
        supabase.from("signals").select("*").order("created_at", { ascending: false }).limit(limit),
      ),
  });

export const useNews = (limit = 40) =>
  useQuery({
    queryKey: ["news", limit],
    queryFn: () =>
      unwrap<NewsItem[]>(
        supabase.from("news_items").select("*").order("published_at", { ascending: false }).limit(limit),
      ),
  });

export const useStrategies = () =>
  useQuery({
    queryKey: ["strategies"],
    queryFn: () => unwrap<Strategy[]>(supabase.from("strategies").select("*").order("name")),
  });

export const useTraders = () =>
  useQuery({
    queryKey: ["traders"],
    queryFn: () => unwrap<Trader[]>(supabase.from("followed_traders").select("*").order("ytd_return", { ascending: false })),
  });

export const useJournal = () =>
  useQuery({
    queryKey: ["journal"],
    queryFn: () =>
      unwrap<JournalEntry[]>(
        supabase.from("journal_entries").select("*").order("entry_date", { ascending: false }),
      ),
  });

export const useConnections = () =>
  useQuery({
    queryKey: ["connections"],
    queryFn: () => unwrap<Connection[]>(supabase.from("connections").select("*").order("provider")),
  });

export const useWatchlist = () =>
  useQuery({
    queryKey: ["watchlist"],
    queryFn: () => unwrap<WatchItem[]>(supabase.from("watchlist_items").select("*").order("market")),
  });

export const useSnapshots = () =>
  useQuery({
    queryKey: ["snapshots"],
    queryFn: () =>
      unwrap<Snapshot[]>(
        supabase
          .from("equity_snapshots")
          .select("market, equity_usd, snapshot_at")
          .order("snapshot_at", { ascending: true }),
      ),
  });

export const useAdvisorMessages = () =>
  useQuery({
    queryKey: ["advisor_messages"],
    queryFn: () =>
      unwrap<AdvisorMessage[]>(
        supabase.from("advisor_messages").select("*").order("created_at", { ascending: true }),
      ),
  });

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function useTableMutation<TVars>(
  table: string,
  fn: (vars: TVars) => PromiseLike<{ error: { message: string } | null }>,
  invalidates: string[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: [table, "mutate"],
    mutationFn: async (vars: TVars) => {
      const { error } = await fn(vars);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidates.forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
}