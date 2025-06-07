import { FunctionReturn, toResult } from '@heyanon/sdk';
import { FunctionOptionsWithExchange } from '../overrides';
import { getMarketObject, fromCcxtMarketToMarketType } from '../helpers/markets';
import { formatDate, extractTimestamp } from '../helpers/format';

interface Props {
    currency: string;
    quoteCurrency: string;
    direction: 'buy' | 'sell' | 'long' | 'short';
    amount: number;
    stopLossPrice: number;
    takeProfitPrice: number;
    reduceOnly: boolean | null;
}

/**
 * Create an OCO (One-Cancels-the-Other) order with both stop loss and take profit.
 * Market-type aware: buy/sell = spot, long/short = futures.
 * Note: Bybit API doesn't support true OCO orders, so this creates a market order with attached SL/TP.
 *
 * @param {Object} props - The function input parameters
 * @param {string} props.currency - Base currency, e.g. "BTC"
 * @param {string} props.quoteCurrency - Quote/settlement currency, e.g. "USDT"
 * @param {string} props.direction - Order direction: "buy", "sell", "long", or "short"
 * @param {number} props.amount - Amount of base currency to trade
 * @param {number} props.stopLossPrice - Stop loss price level
 * @param {number} props.takeProfitPrice - Take profit price level
 * @param {boolean|null} props.reduceOnly - Whether this is a reduce-only order (futures only)
 * @param {FunctionOptions} options HeyAnon SDK options
 * @returns {Promise<FunctionReturn>} The result of the order creation
 */
export async function createOcoOrder({ 
    currency, 
    quoteCurrency, 
    direction, 
    amount, 
    stopLossPrice,
    takeProfitPrice,
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

        // Validate price levels based on direction
        if (isSpot) {
            if (side === 'buy') {
                // For buy orders: take profit should be higher, stop loss should be lower
                if (takeProfitPrice <= stopLossPrice) {
                    return toResult(`For ${direction} orders, take profit price (${takeProfitPrice}) must be higher than stop loss price (${stopLossPrice})`, true);
                }
            } else {
                // For sell orders: take profit should be lower, stop loss should be higher
                if (takeProfitPrice >= stopLossPrice) {
                    return toResult(`For ${direction} orders, take profit price (${takeProfitPrice}) must be lower than stop loss price (${stopLossPrice})`, true);
                }
            }
        } else {
            // Futures logic similar but considering long/short
            if (direction === 'long') {
                if (takeProfitPrice <= stopLossPrice) {
                    return toResult(`For ${direction} positions, take profit price (${takeProfitPrice}) must be higher than stop loss price (${stopLossPrice})`, true);
                }
            } else {
                if (takeProfitPrice >= stopLossPrice) {
                    return toResult(`For ${direction} positions, take profit price (${takeProfitPrice}) must be lower than stop loss price (${stopLossPrice})`, true);
                }
            }
        }

        // Since Bybit doesn't support true OCO orders via API, we'll create a market order with attached SL/TP
        const params: any = {
            stopLossPrice: stopLossPrice,
            takeProfitPrice: takeProfitPrice,
        };
        
        if (reduceOnly && isFutures) {
            params.reduceOnly = true;
        }

        // Create the market order with attached stop loss and take profit
        const order = await exchange.createOrder(market, 'market', side, amount, undefined, params);

        // Format response
        const timestamp = extractTimestamp(order);
        const timeString = timestamp ? formatDate(timestamp) : 'now';
        const marketTypeText = isSpot ? 'spot' : 'futures';
        const actionWord = isSpot 
            ? (direction === 'buy' ? 'bought' : 'sold')
            : (direction === 'long' ? 'longed' : 'shorted');
        const reduceOnlyText = reduceOnly ? ' (reduce-only)' : '';

        let resultMessage = `Successfully ${actionWord} ${amount} ${currency} on ${marketTypeText} market with OCO conditions${reduceOnlyText}:`;
        resultMessage += `\n- Take Profit: ${takeProfitPrice} ${quoteCurrency}`;
        resultMessage += `\n- Stop Loss: ${stopLossPrice} ${quoteCurrency}`;
        
        if (order.cost && order.average) {
            resultMessage += `\n- Executed at average price: ${order.average} ${quoteCurrency} for total cost: ${order.cost} ${quoteCurrency}`;
        }
        
        resultMessage += `\n(Order ID: ${order.id}, market: ${market}, created: ${timeString})`;

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
        if (errorMessage.includes('stopLoss') || errorMessage.includes('takeProfit')) {
            return toResult(`Error with stop loss or take profit configuration: ${errorMessage}`, true);
        }
        if (errorMessage.includes('OCO') || errorMessage.includes('not supported')) {
            // Fallback message if OCO is not supported
            return toResult(`OCO orders may not be fully supported for this market type on Bybit. Consider placing separate stop loss and take profit orders.`, true);
        }
        
        return toResult(`Error creating OCO order: ${errorMessage}`, true);
    }
}