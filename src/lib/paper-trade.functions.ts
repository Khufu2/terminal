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
    if (!error) {
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
    }

    // Backward-compatible fallback for the existing Quantmaxxing database
    // until the atomic RPC migration is applied there.
    const rpcMissing =
      String(error?.code ?? "") === "42883" ||
      String(error?.message ?? "").includes("execute_paper_trade");
    if (!rpcMissing) throw new Error(error.message);

    const fees = data.quantity * price * 0.001;
    const notional = data.quantity * price;

    const { data: account, error: accountError } = await db
      .from("accounts")
      .select("id, balance_usd")
      .eq("user_id", context.userId)
      .eq("market", data.market)
      .eq("mode", "sim")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (accountError) throw new Error(accountError.message);
    if (!account) throw new Error("Paper account not found.");

    const { data: holding, error: holdingError } = await db
      .from("holdings")
      .select("id, quantity, avg_cost")
      .eq("user_id", context.userId)
      .eq("market", data.market)
      .eq("symbol", data.symbol)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (holdingError) throw new Error(holdingError.message);

    const cash = Number(account.balance_usd);
    const oldQty = Number(holding?.quantity ?? 0);
    const oldAvg = Number(holding?.avg_cost ?? 0);

    if (data.side === "buy" && cash < notional + fees) {
      throw new Error("Insufficient paper buying power.");
    }
    if (data.side === "sell" && oldQty < data.quantity) {
      throw new Error("Insufficient paper position.");
    }

    let newQty = oldQty;
    let newAvg = oldAvg;
    let newCash = cash;

    if (data.side === "buy") {
      newQty = oldQty + data.quantity;
      newAvg = newQty > 0 ? (oldQty * oldAvg + notional) / newQty : price;
      newCash = cash - notional - fees;

      if (holding) {
        const { error: updateError } = await db
          .from("holdings")
          .update({ quantity: newQty, avg_cost: newAvg, last_price: price, name: data.name })
          .eq("id", holding.id);
        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await db.from("holdings").insert({
          user_id: context.userId,
          market: data.market,
          symbol: data.symbol,
          name: data.name,
          quantity: data.quantity,
          avg_cost: price,
          last_price: price,
        });
        if (insertError) throw new Error(insertError.message);
      }
    } else {
      newQty = oldQty - data.quantity;
      newCash = cash + notional - fees;
      if (holding) {
        const q = newQty <= 0
          ? db.from("holdings").delete().eq("id", holding.id)
          : db.from("holdings").update({ quantity: newQty, last_price: price }).eq("id", holding.id);
        const { error: updateError } = await q;
        if (updateError) throw new Error(updateError.message);
      }
    }

    const { error: cashError } = await db
      .from("accounts")
      .update({ balance_usd: newCash })
      .eq("id", account.id);
    if (cashError) throw new Error(cashError.message);

    const { data: tx, error: txError } = await db
      .from("transactions")
      .insert({
        user_id: context.userId,
        market: data.market,
        symbol: data.symbol,
        side: data.side,
        order_type: "market",
        quantity: data.quantity,
        price,
        fees,
        status: "filled",
        mode: "sim",
        notes: "Terminal paper fill using server-verified Alpaca reference price",
      })
      .select("id")
      .single();
    if (txError) throw new Error(txError.message);

    return {
      transaction_id: tx.id,
      symbol: data.symbol,
      market: data.market,
      side: data.side,
      quantity: data.quantity,
      price,
      notional,
      fees,
      cash: newCash,
      position_quantity: newQty,
      average_cost: newAvg,
    };
  });
