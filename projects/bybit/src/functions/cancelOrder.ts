import { FunctionReturn, toResult } from '@heyanon/sdk';
import { FunctionOptionsWithExchange } from '../overrides';
import { getMarketObject } from '../helpers/markets';

interface Props {
    orderId: string;
    market: string;
}

/**
 * Cancel a specific order by ID and market.
 *
 * @param {Object} props - The function input parameters
 * @param {string} props.orderId - The order ID to cancel
 * @param {string} props.market - The market symbol, e.g. "BTC/USDT"
 * @param {FunctionOptions} options HeyAnon SDK options
 * @returns {Promise<FunctionReturn>} The result of the cancellation
 */
export async function cancelOrder({ orderId, market }: Props, { exchange }: FunctionOptionsWithExchange): Promise<FunctionReturn> {
    try {
        // Verify market exists
        await getMarketObject(exchange, market);
        
        // Cancel the order
        const result = await exchange.cancelOrder(orderId, market);

        if ((result as any).info && (result as any).info.retMsg === 'OK') {
            return toResult(`Successfully cancelled order ${orderId} on ${market}`);
        } else {
            return toResult(`Order ${orderId} cancelled on ${market}`);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Handle common error cases
        if (errorMessage.includes('Order not found') || errorMessage.includes('110001')) {
            return toResult(`Order ${orderId} not found or already cancelled on ${market}`, true);
        }
        
        return toResult(`Error cancelling order: ${errorMessage}`, true);
    }
}