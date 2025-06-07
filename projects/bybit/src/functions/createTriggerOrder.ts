import { FunctionReturn, toResult } from '@heyanon/sdk';
import { FunctionOptionsWithExchange } from '../overrides';
import { getMarketObject, fromCcxtMarketToMarketType } from '../helpers/markets';
import { formatDate, extractTimestamp } from '../helpers/format';

interface Props {
    currency: string;
    quoteCurrency: string;
    direction: 'buy' | 'sell' | 'long' | 'short';
    amount: number;
    stopPrice: number;
    limitPrice: number | null;
    reduceOnly: boolean | null;
}

/**
 * Create a trigger order with a price condition attached.
 * Market-type aware: buy/sell = spot, long/short = futures.
 * Order-type aware: limitPrice provided = stop-limit, null = stop-market.
 *
 * @param {Object} props - The function input parameters
 * @param {string} props.currency - Base currency, e.g. "BTC"
 * @param {string} props.quoteCurrency - Quote/settlement currency, e.g. "USDT"
 * @param {string} props.direction - Order direction: "buy", "sell", "long", or "short"
 * @param {number} props.amount - Amount of base currency to trade
 * @param {number} props.stopPrice - Price level that triggers the order
 * @param {number|null} props.limitPrice - Limit price for stop-limit (null for stop-market)
 * @param {boolean|null} props.reduceOnly - Whether this is a reduce-only order (futures only)
 * @param {FunctionOptions} options HeyAnon SDK options
 * @returns {Promise<FunctionReturn>} The result of the order creation
 */
export async function createTriggerOrder({ 
    currency, 
    quoteCurrency, 
    direction, 
    amount, 
    stopPrice,
    limitPrice,
    reduceOnly
}: Props, { exchange }: FunctionOptionsWithExchange): Promise<FunctionReturn> {
    try {
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

        // Determine order type
        const orderType = limitPrice ? 'stopLimit' : 'stopMarket';

        // Prepare order parameters
        const params: any = {
            stopPrice: stopPrice,
        };
        
        // Add trigger direction for Bybit
        if (isFutures) {
            params.triggerDirection = side === 'buy' ? 1 : 2; // 1 for rising price, 2 for falling price
        }
        
        if (reduceOnly && isFutures) {
            params.reduceOnly = true;
        }

        // Create the trigger order
        const order = await exchange.createOrder(
            market, 
            orderType, 
            side, 
            amount, 
            limitPrice || undefined, 
            params
        );

        // Format response
        const timestamp = extractTimestamp(order);
        const timeString = timestamp ? formatDate(timestamp) : 'now';
        const marketTypeText = isSpot ? 'spot' : 'futures';
        const triggerText = side === 'buy' ? 'rises to' : 'falls to';
        const limitText = limitPrice ? ` with limit price ${limitPrice} ${quoteCurrency}` : '';
        const reduceOnlyText = reduceOnly ? ' (reduce-only)' : '';

        let resultMessage = `Successfully placed ${orderType} order to ${direction} ${amount} ${currency} on ${marketTypeText} market`;
        resultMessage += ` when price ${triggerText} ${stopPrice} ${quoteCurrency}${limitText}${reduceOnlyText}`;
        resultMessage += ` (Order ID: ${order.id}, market: ${market}, status: ${order.status}, created: ${timeString})`;

        return toResult(resultMessage);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Handle common error cases
        if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
            return toResult(`Insufficient balance to ${direction} ${amount} ${currency}`, true);
        }
        if (errorMessage.includes('minimum') || errorMessage.includes('notional')) {
            return toResult(`Order amount ${amount} is below minimum required for ${currency}/${quoteCurrency}`, true);
        }
        if (errorMessage.includes('trigger') || errorMessage.includes('stop')) {
            return toResult(`Invalid stop price ${stopPrice} for ${currency}/${quoteCurrency}`, true);
        }
        if (errorMessage.includes('price') && errorMessage.includes('invalid')) {
            return toResult(`Invalid price parameters for ${currency}/${quoteCurrency}`, true);
        }
        
        return toResult(`Error creating trigger ${direction} order: ${errorMessage}`, true);
    }
}