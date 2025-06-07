import { AiTool } from '@heyanon/sdk';
import { MAX_MARKETS_IN_RESULTS, MAX_POSITIONS_IN_RESULTS } from './constants';
import { SUPPORTED_MARKET_TYPES } from './helpers/exchange';

const MARKET_TYPE_PARAMETER = {
    name: 'marketType',
    type: 'string',
    description: `Market type`,
    enum: SUPPORTED_MARKET_TYPES,
};

const MARKET_DESCRIPTION = [
    'Symbol of the market.  The type of the market can be inferred from the symbol:',
    '- Spot markets symbols have the form "BTC/USDT", where the FIRST currency is the base currency and the SECOND currency is the quote currency.',
    '- Perpetual markets symbols have the form "BTC/USDT:USDT", where the THIRD currency is the settlement currency.',
    '- Delivery markets (also known as expiry markets) symbols have the form "BTC/USD:BTC-250926", where the LAST part of the symbol is the expiry date of the contract.',
].join(' ');

export const tools: AiTool[] = [
    // Balance and positions
    {
        name: 'getPositions',
        description: `Show the user's most recent ${MAX_POSITIONS_IN_RESULTS} open positions on future markets, including notional, margin, and PnL.`,
        required: [],
        props: [],
    },
    {
        name: 'getPositionOnMarket',
        description: `Show all details on the position held by the user on the given future market.  If you only have the currency, use getPositions and filter by currency.`,
        required: ['market'],
        props: [
            {
                name: 'market',
                type: 'string',
                description: 'Symbol of the market to get position for, e.g. "BTC/USDT:USDT"',
            },
        ],
    },
    {
        name: 'getBalance',
        description: 'Get the unified user balance.  This does not include open positions.  For each currency, show how much is available to trade (free).',
        required: ['currency'],
        props: [{ name: 'currency', type: ['string', 'null'], description: 'Optionally, specify a currency to show balance just for that currency, e.g. "BTC"' }],
    },

    // Market information
    {
        name: 'getCurrencyMarketsOfGivenType',
        description: `Show active markets (also called trading pairs) with the given currency or token.  Show only the first ${MAX_MARKETS_IN_RESULTS} markets.  If the user asks for future markets, the function should be called for both perpetual and delivery markets.`,
        required: ['marketType', 'currency'],
        props: [
            MARKET_TYPE_PARAMETER,
            {
                name: 'currency',
                type: 'string',
                description: 'Currency to get markets for, e.g. "BTC"',
            },
        ],
    },
    {
        name: 'getMarketInfo',
        description:
            'Get price, volume and leverage information about a specific market (also called a trading pair).  Prices are in quote currency.  Always use this function to get up-to-date prices.',
        required: ['market'],
        props: [
            {
                name: 'market',
                type: 'string',
                description: MARKET_DESCRIPTION,
            },
        ],
    },

    // Order management
    {
        name: 'getOpenOrders',
        description: 'Show all open orders for the user, optionally filtered by currency or market.',
        required: ['currency', 'market'],
        props: [
            { name: 'currency', type: ['string', 'null'], description: 'Optionally, specify a currency to filter orders, e.g. "BTC"' },
            { name: 'market', type: ['string', 'null'], description: 'Optionally, specify a market to filter orders, e.g. "BTC/USDT"' },
        ],
    },
    {
        name: 'getOrderById',
        description: 'Get details of a specific order by ID and market.',
        required: ['orderId', 'market'],
        props: [
            { name: 'orderId', type: 'string', description: 'The order ID to fetch' },
            { name: 'market', type: 'string', description: MARKET_DESCRIPTION },
        ],
    },
    {
        name: 'cancelOrder',
        description: 'Cancel a specific order by ID and market.',
        required: ['orderId', 'market'],
        props: [
            { name: 'orderId', type: 'string', description: 'The order ID to cancel' },
            { name: 'market', type: 'string', description: MARKET_DESCRIPTION },
        ],
    },
    {
        name: 'cancelAllOrders',
        description: 'Cancel all open orders, optionally filtered by market.',
        required: ['market'],
        props: [{ name: 'market', type: ['string', 'null'], description: 'Optionally, specify a market to cancel orders only on that market, e.g. "BTC/USDT"' }],
    },

    // Trading - Orders
    {
        name: 'createSimpleOrder',
        description: 'Create a simple order with no conditions (triggers) attached. Market-type aware: buy/sell = spot, long/short = futures. Order-type aware: limitPrice provided = limit order, null = market order.',
        required: ['currency', 'quoteCurrency', 'direction', 'amount', 'limitPrice', 'reduceOnly', 'postOnly'],
        props: [
            { name: 'currency', type: 'string', description: 'Base currency, e.g. "BTC"' },
            { name: 'quoteCurrency', type: 'string', description: 'Quote/settlement currency, e.g. "USDT"' },
            { name: 'direction', type: 'string', description: 'Order direction: "buy", "sell" (spot) or "long", "short" (futures)', enum: ['buy', 'sell', 'long', 'short'] },
            { name: 'amount', type: 'number', description: 'Amount of base currency to trade' },
            { name: 'limitPrice', type: ['number', 'null'], description: 'Limit price (null for market order)' },
            { name: 'reduceOnly', type: ['boolean', 'null'], description: 'Whether this is a reduce-only order (futures only)' },
            { name: 'postOnly', type: ['boolean', 'null'], description: 'Whether this is a post-only order (maker-only)' },
        ],
    },
    {
        name: 'createTriggerOrder',
        description: 'Create a trigger order with a price condition attached. Market-type aware: buy/sell = spot, long/short = futures. Order-type aware: limitPrice provided = stop-limit, null = stop-market.',
        required: ['currency', 'quoteCurrency', 'direction', 'amount', 'stopPrice', 'limitPrice', 'reduceOnly'],
        props: [
            { name: 'currency', type: 'string', description: 'Base currency, e.g. "BTC"' },
            { name: 'quoteCurrency', type: 'string', description: 'Quote/settlement currency, e.g. "USDT"' },
            { name: 'direction', type: 'string', description: 'Order direction: "buy", "sell" (spot) or "long", "short" (futures)', enum: ['buy', 'sell', 'long', 'short'] },
            { name: 'amount', type: 'number', description: 'Amount of base currency to trade' },
            { name: 'stopPrice', type: 'number', description: 'Price level that triggers the order' },
            { name: 'limitPrice', type: ['number', 'null'], description: 'Limit price for stop-limit (null for stop-market)' },
            { name: 'reduceOnly', type: ['boolean', 'null'], description: 'Whether this is a reduce-only order (futures only)' },
        ],
    },
    {
        name: 'createTrailingStopOrder',
        description: 'Create a trailing stop order that follows price movements. Market-type aware: buy/sell = spot, long/short = futures. For futures, creates position then sets trailing stop.',
        required: ['currency', 'quoteCurrency', 'direction', 'amount', 'trailingPercent', 'activationPrice', 'reduceOnly'],
        props: [
            { name: 'currency', type: 'string', description: 'Base currency, e.g. "BTC"' },
            { name: 'quoteCurrency', type: 'string', description: 'Quote/settlement currency, e.g. "USDT"' },
            { name: 'direction', type: 'string', description: 'Order direction: "buy", "sell" (spot) or "long", "short" (futures)', enum: ['buy', 'sell', 'long', 'short'] },
            { name: 'amount', type: 'number', description: 'Amount of base currency to trade' },
            { name: 'trailingPercent', type: 'number', description: 'Trailing percentage (0.1% - 10%)' },
            { name: 'activationPrice', type: ['number', 'null'], description: 'Price level to activate trailing (optional)' },
            { name: 'reduceOnly', type: ['boolean', 'null'], description: 'Whether this is a reduce-only order (futures only)' },
        ],
    },
    {
        name: 'createOcoOrder',
        description: 'Create an OCO (One-Cancels-the-Other) order with both stop loss and take profit. Market-type aware: buy/sell = spot, long/short = futures. Creates market order with attached SL/TP.',
        required: ['currency', 'quoteCurrency', 'direction', 'amount', 'stopLossPrice', 'takeProfitPrice', 'reduceOnly'],
        props: [
            { name: 'currency', type: 'string', description: 'Base currency, e.g. "BTC"' },
            { name: 'quoteCurrency', type: 'string', description: 'Quote/settlement currency, e.g. "USDT"' },
            { name: 'direction', type: 'string', description: 'Order direction: "buy", "sell" (spot) or "long", "short" (futures)', enum: ['buy', 'sell', 'long', 'short'] },
            { name: 'amount', type: 'number', description: 'Amount of base currency to trade' },
            { name: 'stopLossPrice', type: 'number', description: 'Stop loss price level' },
            { name: 'takeProfitPrice', type: 'number', description: 'Take profit price level' },
            { name: 'reduceOnly', type: ['boolean', 'null'], description: 'Whether this is a reduce-only order (futures only)' },
        ],
    },

    // Position management
    {
        name: 'closePosition',
        description: 'Close a position on a futures market (perpetual or delivery). Can close partial or full position.',
        required: ['market', 'percentage'],
        props: [
            { name: 'market', type: 'string', description: 'Futures market symbol, e.g. "BTC/USDT:USDT" or "BTC/USDT:USDT-250926"' },
            { name: 'percentage', type: ['number', 'null'], description: 'Percentage of position to close (1-100), defaults to 100' },
        ],
    },
    {
        name: 'closeAllPositions',
        description: 'Close all open positions, optionally filtered by currency.',
        required: ['currency'],
        props: [{ name: 'currency', type: ['string', 'null'], description: 'Optionally, specify a currency to close only positions for that currency, e.g. "BTC"' }],
    },

    // Leverage and margin
    {
        name: 'setMarketLeverage',
        description: 'Set the user configured leverage for a specific futures market',
        required: ['market', 'leverage'],
        props: [
            {
                name: 'market',
                type: 'string',
                description: 'Market symbol, e.g. "BTC/USDT:USDT" or "BTC/USDT:USDT-250926"',
            },
            {
                name: 'leverage',
                type: 'number',
                description: 'Leverage to set, e.g. 10 for 10x, 50 for 50x, etc.',
            },
        ],
    },
    {
        name: 'setMarginMode',
        description: 'Set the margin mode for the entire account (affects all positions). On Bybit, margin mode is account-wide.',
        required: ['marginMode'],
        props: [
            {
                name: 'marginMode',
                type: 'string',
                description: 'Margin mode for the account',
                enum: ['cross', 'isolated', 'portfolio'],
            },
        ],
    },
];
