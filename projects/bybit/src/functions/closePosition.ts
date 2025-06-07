import { FunctionReturn, toResult } from '@heyanon/sdk';
import { FunctionOptionsWithExchange } from '../overrides';
import { getMarketObject, fromCcxtMarketToMarketType } from '../helpers/markets';
import { formatDate, extractTimestamp } from '../helpers/format';

interface Props {
    market: string;
    percentage: number | null; // If not provided, closes 100% of position
}

/**
 * Close a position on a futures market (perpetual or delivery).
 *
 * @param {Object} props - The function input parameters
 * @param {string} props.market - The market symbol, e.g. "BTC/USDT:USDT"
 * @param {number} props.percentage - Percentage of position to close (1-100), defaults to 100
 * @param {FunctionOptions} options HeyAnon SDK options
 * @returns {Promise<FunctionReturn>} The result of the position closure
 */
export async function closePosition({ market, percentage }: Props, { exchange }: FunctionOptionsWithExchange): Promise<FunctionReturn> {
    try {
        // Verify market exists and is a futures market
        const marketObject = await getMarketObject(exchange, market);
        const marketType = fromCcxtMarketToMarketType(marketObject);
        
        if (marketType !== 'perpetual' && marketType !== 'delivery') {
            return toResult(`Position closing is only supported for futures markets, but ${market} is a ${marketType} market`, true);
        }

        // Validate percentage (default to 100)
        const actualPercentage = percentage || 100;
        if (actualPercentage <= 0 || actualPercentage > 100) {
            return toResult(`Percentage must be between 1 and 100, but got ${actualPercentage}`, true);
        }

        // Get current position
        const positions = await exchange.fetchPositions([market]);
        const position = positions.find(p => p.symbol === market && p.contracts && p.contracts > 0);
        
        if (!position || !position.contracts || position.contracts === 0) {
            return toResult(`No open position found on ${market}`);
        }

        // Calculate amount to close
        const amountToClose = (position.contracts * actualPercentage) / 100;
        const oppositeSide = position.side === 'long' ? 'sell' : 'buy';

        // Create market order to close position
        const order = await exchange.createOrder(
            market, 
            'market', 
            oppositeSide, 
            amountToClose, 
            undefined, 
            { reduceOnly: true }
        );

        // Format response
        const timestamp = extractTimestamp(order);
        const timeString = timestamp ? formatDate(timestamp) : 'now';
        
        let resultMessage = `Successfully closed ${actualPercentage}% of your ${position.side} position on ${market}`;
        resultMessage += ` (${amountToClose} ${marketObject.base})`;
        
        if (order.cost && order.average) {
            resultMessage += ` at average price ${order.average} ${marketObject.quote}`;
        }
        
        resultMessage += ` (Order ID: ${order.id}, created: ${timeString})`;

        return toResult(resultMessage);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Handle common error cases
        if (errorMessage.includes('position') && errorMessage.includes('not found')) {
            return toResult(`No open position found on ${market}`, true);
        }
        if (errorMessage.includes('reduce')) {
            return toResult(`Cannot close position: ${errorMessage}`, true);
        }
        
        return toResult(`Error closing position: ${errorMessage}`, true);
    }
}