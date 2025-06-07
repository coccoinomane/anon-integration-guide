import { FunctionReturn, toResult } from '@heyanon/sdk';
import { FunctionOptionsWithExchange } from '../overrides';
import { getMarketObject, fromCcxtMarketToMarketType } from '../helpers/markets';
import { formatDate, extractTimestamp } from '../helpers/format';
import { MIN_TRAILING_PERCENT, MAX_TRAILING_PERCENT } from '../helpers/exchange';
import { bybit } from 'ccxt';

interface Props {
    currency: string;
    quoteCurrency: string;
    direction: 'buy' | 'sell' | 'long' | 'short';
    amount: number;
    trailingPercent: number;
    activationPrice: number | null;
    reduceOnly: boolean | null;
}

/**
 * Create a trailing stop order that follows price movements.
 * Market-type aware: buy/sell = spot, long/short = futures.
 * Note: Bybit trailing stops require creating a position first, then setting the trailing stop.
 *
 * @param {Object} props - The function input parameters
 * @param {string} props.currency - Base currency, e.g. "BTC"
 * @param {string} props.quoteCurrency - Quote/settlement currency, e.g. "USDT"
 * @param {string} props.direction - Order direction: "buy", "sell", "long", or "short"
 * @param {number} props.amount - Amount of base currency to trade
 * @param {number} props.trailingPercent - Trailing percentage (0.1% - 10%)
 * @param {number|null} props.activationPrice - Price level to activate trailing (optional)
 * @param {boolean|null} props.reduceOnly - Whether this is a reduce-only order (futures only)
 * @param {FunctionOptions} options HeyAnon SDK options
 * @returns {Promise<FunctionReturn>} The result of the order creation
 */
export async function createTrailingStopOrder({ 
    currency, 
    quoteCurrency, 
    direction, 
    amount, 
    trailingPercent,
    activationPrice,
    reduceOnly
}: Props, { exchange }: FunctionOptionsWithExchange): Promise<FunctionReturn> {
    try {
        // Validate trailing percentage
        if (trailingPercent < MIN_TRAILING_PERCENT || trailingPercent > MAX_TRAILING_PERCENT) {
            return toResult(`Trailing percentage must be between ${MIN_TRAILING_PERCENT}% and ${MAX_TRAILING_PERCENT}%, but got ${trailingPercent}%`, true);
        }

        // Determine market type from direction terminology
        const isSpot = direction === 'buy' || direction === 'sell';
        const isFutures = direction === 'long' || direction === 'short';
        
        if (!isSpot && !isFutures) {
            return toResult(`Invalid direction "${direction}". Use "buy/sell" for spot or "long/short" for futures.`, true);
        }

        // Construct market symbol based on market type
        let market: string;
        let side: 'buy' | 'sell';
        
        if (isSpot) {
            market = `${currency}/${quoteCurrency}`;
            side = direction as 'buy' | 'sell';
        } else {
            // Futures market
            market = `${currency}/${quoteCurrency}:${quoteCurrency}`;
            side = direction === 'long' ? 'buy' : 'sell';
        }

        // Verify market exists and check market type
        const marketObject = await getMarketObject(exchange, market);
        const actualMarketType = fromCcxtMarketToMarketType(marketObject);
        
        // Validate market type matches direction
        if (isSpot && actualMarketType !== 'spot') {
            return toResult(`Direction "${direction}" indicates spot trading, but ${market} is a ${actualMarketType} market`, true);
        }
        if (isFutures && actualMarketType !== 'perpetual' && actualMarketType !== 'delivery') {
            return toResult(`Direction "${direction}" indicates futures trading, but ${market} is a ${actualMarketType} market`, true);
        }

        // For Bybit, trailing stops work differently:
        // 1. For futures: Create position first, then set trailing stop using trading-stop API
        // 2. For spot: Use trailingStopMarket order type (limited support)

        if (isFutures) {
            // Futures: Create market order first, then set trailing stop
            const params: any = {};
            if (reduceOnly) {
                params.reduceOnly = true;
            }

            // Create the initial position
            const order = await exchange.createOrder(market, 'market', side, amount, undefined, params);

            // Now set trailing stop using Bybit's trading-stop API
            const trailingStopParams = {
                symbol: marketObject.id, // Use exchange-specific symbol
                trailingStop: trailingPercent,
                ...(activationPrice && { activePrice: activationPrice })
            };

            try {
                await (exchange as bybit).privatePostV5PositionTradingStop(trailingStopParams);
            } catch (trailingError) {
                // If trailing stop fails, the position is still created
                const errorMessage = trailingError instanceof Error ? trailingError.message : String(trailingError);
                return toResult(`Position created but failed to set trailing stop: ${errorMessage}. Order ID: ${order.id}`, true);
            }

            // Format response
            const timestamp = extractTimestamp(order);
            const timeString = timestamp ? formatDate(timestamp) : 'now';
            const activationText = activationPrice ? ` (activates at ${activationPrice} ${quoteCurrency})` : '';

            return toResult(`Successfully ${direction}ed ${amount} ${currency} with ${trailingPercent}% trailing stop${activationText} (Order ID: ${order.id}, market: ${market}, created: ${timeString})`);

        } else {
            // Spot: Try to use trailingStopMarket order type (limited support)
            const params: any = {
                trailingPercent: trailingPercent,
                ...(activationPrice && { activationPrice: activationPrice })
            };

            try {
                const order = await exchange.createOrder(market, 'trailingStopMarket', side, amount, undefined, params);
                
                const timestamp = extractTimestamp(order);
                const timeString = timestamp ? formatDate(timestamp) : 'now';
                const activationText = activationPrice ? ` (activates at ${activationPrice} ${quoteCurrency})` : '';

                return toResult(`Successfully placed trailing stop order to ${direction} ${amount} ${currency} with ${trailingPercent}% trailing${activationText} (Order ID: ${order.id}, market: ${market}, created: ${timeString})`);

            } catch (error) {
                // If trailingStopMarket is not supported, inform user
                return toResult(`Trailing stop orders may not be fully supported for spot trading on Bybit. Consider using futures markets or manual stop-loss management.`, true);
            }
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Handle common error cases
        if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
            return toResult(`Insufficient balance to ${direction} ${amount} ${currency}`, true);
        }
        if (errorMessage.includes('minimum') || errorMessage.includes('notional')) {
            return toResult(`Order amount ${amount} is below minimum required for ${currency}/${quoteCurrency}`, true);
        }
        if (errorMessage.includes('trailing') || errorMessage.includes('stop')) {
            return toResult(`Error with trailing stop configuration: ${errorMessage}`, true);
        }
        
        return toResult(`Error creating trailing stop order: ${errorMessage}`, true);
    }
}