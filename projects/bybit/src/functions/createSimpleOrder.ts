import { FunctionReturn, toResult } from '@heyanon/sdk';
import { FunctionOptionsWithExchange } from '../overrides';
import { getMarketObject, fromCcxtMarketToMarketType } from '../helpers/markets';
import { formatDate, extractTimestamp } from '../helpers/format';

interface Props {
    currency: string;
    quoteCurrency: string;
    direction: 'buy' | 'sell' | 'long' | 'short';
    amount: number;
    limitPrice: number | null;
    reduceOnly: boolean | null;
    postOnly: boolean | null;
}

/**
 * Create a simple order with no conditions (triggers) attached.
 * Market-type aware: buy/sell = spot, long/short = futures.
 * Order-type aware: limitPrice provided = limit order, null = market order.
 *
 * @param {Object} props - The function input parameters
 * @param {string} props.currency - Base currency, e.g. "BTC"
 * @param {string} props.quoteCurrency - Quote/settlement currency, e.g. "USDT"
 * @param {string} props.direction - Order direction: "buy", "sell", "long", or "short"
 * @param {number} props.amount - Amount of base currency to trade
 * @param {number|null} props.limitPrice - Limit price (null for market order)
 * @param {boolean|null} props.reduceOnly - Whether this is a reduce-only order (futures only)
 * @param {boolean|null} props.postOnly - Whether this is a post-only order (maker-only)
 * @param {FunctionOptions} options HeyAnon SDK options
 * @returns {Promise<FunctionReturn>} The result of the order creation
 */
export async function createSimpleOrder({ 
    currency, 
    quoteCurrency, 
    direction, 
    amount, 
    limitPrice,
    reduceOnly,
    postOnly 
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
        const orderType = limitPrice ? 'limit' : 'market';

        // Prepare order parameters
        const params: any = {};
        if (reduceOnly && isFutures) {
            params.reduceOnly = true;
        }
        if (postOnly) {
            params.postOnly = true;
        }

        // Create the order
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
        const actionWord = isSpot 
            ? (direction === 'buy' ? 'bought' : 'sold')
            : (direction === 'long' ? 'longed' : 'shorted');
        const priceText = limitPrice ? ` at ${limitPrice} ${quoteCurrency}` : '';
        const reduceOnlyText = reduceOnly ? ' (reduce-only)' : '';
        const postOnlyText = postOnly ? ' (maker-only)' : '';

        let resultMessage = `Successfully placed ${orderType} order to ${direction} ${amount} ${currency}${priceText} on ${marketTypeText} market${reduceOnlyText}${postOnlyText}`;
        
        if (order.cost && order.average && orderType === 'market') {
            resultMessage += ` - ${actionWord} at average price ${order.average} ${quoteCurrency} for total cost ${order.cost} ${quoteCurrency}`;
        }
        
        resultMessage += ` (Order ID: ${order.id}, market: ${market}, created: ${timeString})`;

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
        if (errorMessage.includes('price') && errorMessage.includes('invalid')) {
            return toResult(`Price ${limitPrice} is invalid for ${currency}/${quoteCurrency}`, true);
        }
        
        return toResult(`Error creating ${direction} order: ${errorMessage}`, true);
    }
}