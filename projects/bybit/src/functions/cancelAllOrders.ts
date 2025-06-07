import { FunctionReturn, toResult } from '@heyanon/sdk';
import { FunctionOptionsWithExchange } from '../overrides';
import { getMarketObject } from '../helpers/markets';

interface Props {
    market: string | null;
}

/**
 * Cancel all open orders, optionally filtered by market.
 *
 * @param {Object} props - The function input parameters
 * @param {string|null} props.market - Optionally, specify a market to cancel orders only on that market, e.g. "BTC/USDT"
 * @param {FunctionOptions} options HeyAnon SDK options
 * @returns {Promise<FunctionReturn>} The result of the cancellation
 */
export async function cancelAllOrders({ market }: Props, { exchange }: FunctionOptionsWithExchange): Promise<FunctionReturn> {
    try {
        // Verify market exists if specified
        if (market) {
            await getMarketObject(exchange, market);
        }

        // Get current open orders to count them
        const openOrdersBefore = market 
            ? await exchange.fetchOpenOrders(market)
            : await exchange.fetchOpenOrders();

        if (openOrdersBefore.length === 0) {
            return toResult(market 
                ? `No open orders to cancel on ${market}`
                : 'No open orders to cancel'
            );
        }

        // Cancel all orders
        const results = market 
            ? await exchange.cancelAllOrders(market)
            : await exchange.cancelAllOrders();

        // Check results and provide feedback
        if (Array.isArray(results)) {
            const successCount = results.filter(result => 
                result.info && (result.info.retMsg === 'OK' || result.status === 'canceled')
            ).length;
            
            if (successCount > 0) {
                return toResult(market 
                    ? `Successfully cancelled ${successCount} order(s) on ${market}`
                    : `Successfully cancelled ${successCount} order(s)`
                );
            }
        }

        // Fallback message if we can't determine exact count
        return toResult(market 
            ? `Cancelled all orders on ${market}`
            : 'Cancelled all orders'
        );

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        return toResult(`Error cancelling orders: ${errorMessage}`, true);
    }
}