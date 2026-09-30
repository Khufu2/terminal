# Terminal

Consumer-grade AI market research, backtesting and paper trading.

Terminal keeps the product UI separate from the quant engine:

```
Terminal web (TanStack Start + React)
        |
        | authenticated server functions
        v
Supabase <----> Terminal Quant Engine
                    |
                    v
             vibe-trading-ai 0.1.16
```

## Product surfaces

- **Home** — portfolio value, positions, risk, research signals, news and activity.
- **Explore** — tracked instruments with verified market data when a provider is configured.
- **Trade** — paper orders only in the commercial baseline.
- **Research** — persistent natural-language research sessions backed by Vibe-Trading.
- **Labs** — structured backtest requests with fees, drawdown and validation requirements.
- **Portfolio / Strategies / Activity** — account state and user-owned records.
- **Connections** — server-side provider/engine health. Secrets never go to the browser.

## Local web setup

Install Node 22+, then:

```bash
npm ci
npm run dev
```

Required web environment:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
```

For verified Alpaca market data:

```bash
ALPACA_API_KEY_ID=
ALPACA_API_SECRET_KEY=
ALPACA_PAPER=true
```

For AI research:

```bash
QUANT_ENGINE_URL=
QUANT_ENGINE_API_KEY=
```

## Quant engine

The isolated Docker service lives in `services/quant-engine`. It pins
`vibe-trading-ai==0.1.16` and starts the upstream FastAPI server.

The engine requires its own `API_AUTH_KEY`; the same secret is stored only
server-side in the web deployment as `QUANT_ENGINE_API_KEY`.

See `services/quant-engine/README.md`.

## Database

Apply the migrations in `supabase/migrations` to the Supabase project used by
the web deployment. The newest commercial-safety migration replaces the old
demo-data bootstrap for **future users**, disables the legacy Aurum scheduler,
and enforces paper-only risk flags.

It intentionally does **not** delete existing user data automatically.

## Safety baseline

- New users receive **$100,000 total simulated buying power**.
- No fake holdings, returns, news, signals, fills or performance history are created for new users.
- Browser-side live broker secrets are not supported.
- Legacy autonomous live toggles are disabled and the old scheduled trader is retired.
- A successful backtest never becomes a live order automatically.

## Upstream attribution

Terminal integrates the MIT-licensed HKUDS/Vibe-Trading project as an isolated
research service. See `THIRD_PARTY_NOTICES.md` and preserve upstream license
and notice requirements when redistributing upstream code.
