# Terminal Quant Engine

Terminal runs the MIT-licensed **HKUDS/Vibe-Trading** engine as an isolated service instead of merging its frontend into Terminal.

## Deploy

Build this directory as a Docker service (Railway, Fly.io, Render, or another container host) with a persistent volume mounted at `/data`.

Required environment variables:

- `API_AUTH_KEY`: long random bearer secret. Never expose it to the browser.
- an LLM provider. The default Terminal setup uses `LANGCHAIN_PROVIDER=gemini`, `LANGCHAIN_MODEL_NAME=gemini-3.5-flash`, and `GEMINI_API_KEY`.
- `VIBE_TRADING_RUNTIME_DIR=/data`.

Then configure the Terminal web deployment with:

- `QUANT_ENGINE_URL=https://<engine-host>`
- `QUANT_ENGINE_API_KEY=<same API_AUTH_KEY>`

The browser never talks to the engine directly. Terminal server functions proxy authenticated research requests and keep the bearer key server-side.

## Safety boundary

Terminal launches Vibe-Trading as a **research/backtesting engine**. Live broker execution is not enabled by this service definition. Broker credentials and execution mandates must be added separately and explicitly.

Pinned upstream package: `vibe-trading-ai==0.1.16`.
