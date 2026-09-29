import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAlpacaCreds, latestReferencePrice } from "@/lib/alpaca.server";

export const getPaperTradingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const creds = getAlpacaCreds();
    return {
      alpacaData: Boolean(creds),
      safeMode: true,
      brokerOrdersEnabled: false,
    };
  });

export const placePaperTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    market: string;
    symbol: string;
    name?: string;
    side: "buy" | "sell";
    quantity: number;
  }) => {
    const market = String(input?.market ?? "").trim().toLowerCase();
    const symbol = String(input?.symbol ?? "").trim().toUpperCase().slice(0, 32);
    const side = input?.side === "sell" ? "sell" : "buy";
    const quantity = Number(input?.quantity ?? 0);
    const name = String(input?.name ?? symbol).trim().slice(0, 120);
    if (!["stocks", "crypto"].includes(market)) throw new Error("Paper trading currently supports stocks and crypto.");
    if (!symbol) throw new Error("Symbol is required.");
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Quantity must be greater than zero.");
    if (quantity > 1_000_000) throw new Error("Quantity is too large.");
    return { market, symbol, side, quantity, name };
  })
  .handler(async ({ data, context }) => {
    const creds = getAlpacaCreds();
    if (!creds) throw new Error("Alpaca market data is not configured.");

    const price = await latestReferencePrice(creds, data.market, data.symbol);
    if (!price || price <= 0) throw new Error("Could not obtain a verified Alpaca reference price.");

    const db = context.supabase as any;
    const { data: result, error } = await db.rpc("execute_paper_trade", {
      p_market: data.market,
      p_symbol: data.symbol,
      p_name: data.name,
      p_side: data.side,
      p_quantity: data.quantity,
      p_price: price,
      p_fee_bps: 10,
    });
    if (error) throw new Error(error.message);

    return result as {
      transaction_id: string;
      symbol: string;
      market: string;
      side: string;
      quantity: number;
      price: number;
      notional: number;
      fees: number;
      cash: number;
      position_quantity: number;
      average_cost: number;
    };
  });
