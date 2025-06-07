# CCXT Functions Summary for Bybit Implementation

This document summarizes the relevant CCXT functions needed to implement the missing trading tools for the Bybit integration.

## Core CCXT Functions

### Order Management

#### createOrder
- **Purpose**: Place new trading orders (market, limit, conditional)
- **Signature**: `exchange.createOrder(symbol, type, side, amount, price, params)`
- **Parameters**:
  - `symbol` (string): Market symbol (e.g., 'BTC/USDT', 'BTC/USDT:USDT')
  - `type` (string): Order type ('market', 'limit', 'stop', 'stopLimit', etc.)
  - `side` (string): Order side ('buy', 'sell')
  - `amount` (number): Amount of base currency to trade
  - `price` (number, optional): Price per unit (required for limit orders)
  - `params` (object, optional): Exchange-specific parameters

#### cancelOrder
- **Purpose**: Cancel a specific order
- **Signature**: `exchange.cancelOrder(id, symbol, params)`
- **Parameters**:
  - `id` (string): Order ID
  - `symbol` (string): Market symbol
  - `params` (object, optional): Exchange-specific parameters

#### cancelAllOrders
- **Purpose**: Cancel all open orders
- **Signature**: `exchange.cancelAllOrders(symbol, params)`
- **Parameters**:
  - `symbol` (string, optional): Limit to specific market
  - `params` (object, optional): Exchange-specific parameters

#### fetchOrders
- **Purpose**: Fetch order history
- **Signature**: `exchange.fetchOrders(symbol, since, limit, params)`
- **Parameters**:
  - `symbol` (string, optional): Market symbol filter
  - `since` (number, optional): Start timestamp
  - `limit` (number, optional): Max number of orders
  - `params` (object, optional): Exchange-specific parameters

#### fetchOpenOrders
- **Purpose**: Fetch currently open orders
- **Signature**: `exchange.fetchOpenOrders(symbol, since, limit, params)`
- **Parameters**:
  - `symbol` (string, optional): Market symbol filter
  - `since` (number, optional): Start timestamp
  - `limit` (number, optional): Max number of orders
  - `params` (object, optional): Exchange-specific parameters

#### fetchOrder
- **Purpose**: Fetch details of a specific order
- **Signature**: `exchange.fetchOrder(id, symbol, params)`
- **Parameters**:
  - `id` (string): Order ID
  - `symbol` (string): Market symbol
  - `params` (object, optional): Exchange-specific parameters

### Position Management

#### fetchPositions
- **Purpose**: Fetch all open positions
- **Signature**: `exchange.fetchPositions(symbols, params)`
- **Parameters**:
  - `symbols` (array, optional): Array of market symbols to filter
  - `params` (object, optional): Exchange-specific parameters

#### setLeverage
- **Purpose**: Set leverage for a market
- **Signature**: `exchange.setLeverage(leverage, symbol, params)`
- **Parameters**:
  - `leverage` (number): Leverage multiplier (e.g., 10 for 10x)
  - `symbol` (string): Market symbol
  - `params` (object, optional): Exchange-specific parameters

#### setMarginMode
- **Purpose**: Set margin mode (cross/isolated)
- **Signature**: `exchange.setMarginMode(marginMode, symbol, params)`
- **Parameters**:
  - `marginMode` (string): 'cross' or 'isolated'
  - `symbol` (string): Market symbol
  - `params` (object, optional): Exchange-specific parameters

### Account Functions

#### fetchBalance
- **Purpose**: Get account balance
- **Signature**: `exchange.fetchBalance(params)`
- **Parameters**:
  - `params` (object, optional): Exchange-specific parameters

## Bybit-Specific Considerations

### Market Types
- **Spot**: BTC/USDT, ETH/USDC
- **Perpetual**: BTC/USDT:USDT, ETH/USDT:USDT
- **Delivery**: BTC/USDT:USDT-250926, ETH/USDT:USDT-250926

### UTA 2.0 Pro
- Unified Trading Account approach
- No fund transfers needed between spot/futures
- Single balance across all market types
- Must set `enableUnifiedAccount: true` in exchange options

### Order Types
- **Market**: Immediate execution at current price
- **Limit**: Execute at specified price or better
- **Stop**: Trigger order when price reaches level
- **Stop Market**: Market order triggered by price
- **Take Profit**: Profit-taking order
- **Take Profit Market**: Market order for profit-taking
- **Trailing Stop**: Stop order that follows price

### Conditional Orders
Use `params` object to specify:
- `stopPrice`: Trigger price for stop orders
- `triggerDirection`: Direction of price movement to trigger
- `reduceOnly`: true for position-reducing orders
- `postOnly`: true for maker-only orders

### Leverage and Margin
- Leverage is set per-market
- Margin mode is account-wide (not per-market)
- Supported margin modes: ISOLATED_MARGIN, REGULAR_MARGIN, PORTFOLIO_MARGIN

### Error Handling
Always wrap CCXT calls in try-catch blocks and return appropriate error messages using `toResult(message, true)` for errors.