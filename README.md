# Terminal

Consumer-grade AI trading research platform.

## Architecture

- **Web app:** TanStack Start + React + Supabase, migrated from `Khufu2/quantmaxxing`.
- **Quant engine:** isolated Python service built around `HKUDS/Vibe-Trading` (`vibe-trading-ai`), pinned to a known upstream version/commit.
- **Execution posture:** paper/simulation first. Live broker execution is opt-in and must be separately authorized.
- **Product UX:** original consumer-finance interface inspired by the clarity and speed of modern trading products, without copying third-party branding or trade dress.

## Product surfaces

Home / Portfolio · Explore / Markets · Asset Detail · AI Research Agent · Backtests / Labs · Strategies · Activity / Journal · Broker & Data Connections.

## Upstream attribution

Terminal may integrate MIT-licensed software from HKUDS/Vibe-Trading. Upstream license and notice files must remain preserved wherever upstream code is distributed.
