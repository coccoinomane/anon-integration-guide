# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
pnpm install

# Test the agent with a question
pnpm ask-bybit "Show my balance"

# Debug LLM interactions
pnpm ask-bybit "Show me my balance" --debug-llm

# Debug tool calls
pnpm ask-bybit "Show my positions" --debug-tools
```

## Project Architecture

This is a Bybit exchange integration for HeyAnon.ai that provides spot and futures trading capabilities through AI tools.

### Core Structure

- **`src/index.ts`** - Main entry point that exports the HeyAnon SDK adapter
- **`src/tools.ts`** - Tool definitions for the AI agent (market info, positions, balance, etc.)
- **`src/functions/`** - Implementation of each tool function
- **`src/helpers/`** - Utility functions for exchange operations, formatting, and data processing
- **`src/agent/`** - Standalone agent for testing the integration with OpenAI/DeepSeek

### Key Components

**Exchange Integration**: Uses CCXT library to interact with Bybit V5 API. Exchange-specific configurations are in `src/helpers/exchange.ts`, including UTA 2.0 Pro settings.

**Tool System**: Each function in `src/functions/` corresponds to a tool definition in `src/tools.ts`. Tools follow the HeyAnon SDK pattern with `toResult()` returns.

**Trading Tools**:

- Use `createSimpleOrder` for orders with no conditions (triggers) attached
- Use `createTriggerOrder` for orders with price conditions (stop orders)
- Both tools are market-type aware: "buy/sell" = spot, "long/short" = futures
- Both tools are order-type aware: `limitPrice` provided = limit order, null = market order

**GNU-style Design**: Each tool does one thing well. For complex operations like "10x long BTC with stop loss", the LLM should call multiple tools in sequence (e.g., `setMarketLeverage` then `createTriggerOrder`).

**Market types**: Supports three market types with symbol conventions:

- Spot: `BTC/USDT`, `BTC/USDC`, `ETH/USDT`
- Perpetual: `BTC/USDT:USDT`, `BTC/USDC:USDC`, `ETH/USDT:USDT`
- Delivery (a.k.a. Expiry): `BTC/USDT:USDT-250926`, `BTC/USDC:USDC-250926`, `ETH/USDT:USDT-250926`

**Testing Agent**: `src/agent/` contains a standalone OpenAI/DeepSeek agent for testing tools. Supports both mainnet and testnet via environment variables.

## Environment Setup

Create `.env` file with:

```bash
OPENAI_API_KEY=your_key_here
BYBIT_API_KEY=your_bybit_key
BYBIT_SECRET_KEY=your_bybit_secret
# Optional testnet
BYBIT_USE_TESTNET=true
BYBIT_TESTNET_API_KEY=testnet_key
BYBIT_TESTNET_SECRET_KEY=testnet_secret
```

## Bybit-Specific Behaviors

- Uses Unified Trading Account (UTA 2.0 Pro) - seamless cross-product trading
- Leverage is set per-market, margin mode is account-wide
- No fund transfers needed between spot/futures (UTA handles this)
- Supports both mainnet and testnet environments
- API keys expire after 3 months unless IP whitelisted

## Tool definition

Tools defined in `src/tools.ts` use strict mode. This means that all parameters must be listed in the `required` array, even if they are optional. Optional parameters are still supported, via the `null` value. For example, an optional string has type `['string', 'null']`.
