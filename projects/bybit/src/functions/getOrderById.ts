import { FunctionReturn, toResult } from '@heyanon/sdk';
import { FunctionOptionsWithExchange } from '../overrides';
import { getMarketObject } from '../helpers/markets';
import { formatDate, extractTimestamp } from '../helpers/format';

interface Props {
    orderId: string;
    market: string;
}

/**
 * Get details of a specific order by ID and market.
 *
 * @param {Object} props - The function input parameters
 * @param {string} props.orderId - The order ID to fetch
 * @param {string} props.market - The market symbol, e.g. "BTC/USDT"
 * @param {FunctionOptions} options HeyAnon SDK options
 * @returns {Promise<FunctionReturn>} The order details
 */
export async function getOrderById({ orderId, market }: Props, { exchange }: FunctionOptionsWithExchange): Promise<FunctionReturn> {
    try {
        // Verify market exists
        const marketObject = await getMarketObject(exchange, market);
        
        // Fetch the specific order
        const order = await exchange.fetchOrder(orderId, market);

        if (!order) {
            return toResult(`Order ${orderId} not found on market ${market}`, true);
        }

        // Format order details
        const timestamp = extractTimestamp(order);
        const timeString = timestamp ? formatDate(timestamp) : 'N/A';
        const price = order.price ? `${order.price} ${marketObject.quote}` : 'N/A';
        const triggerPrice = order.triggerPrice ? `${order.triggerPrice} ${marketObject.quote}` : 'N/A';
        const amount = order.amount ? `${order.amount} ${marketObject.base}` : 'N/A';
        const filled = order.filled ? `${order.filled} ${marketObject.base}` : '0';
        const filledPercent = order.filled && order.amount ? `${((order.filled / order.amount) * 100).toFixed(1)}%` : '0%';
        const cost = order.cost ? `${order.cost} ${marketObject.quote}` : 'N/A';
        const fee = order.fee ? `${order.fee.cost} ${order.fee.currency}` : 'N/A';
        const reduceOnly = order.reduceOnly ? 'Yes' : 'No';

        const details = [
            `Order ID: ${order.id}`,
            `Market: ${order.symbol}`,
            `Type: ${order.type}`,
            `Side: ${order.side}`,
            `Status: ${order.status}`,
            `Amount: ${amount}`,
            `Price: ${price}`,
            `Trigger Price: ${triggerPrice}`,
            `Filled: ${filled} (${filledPercent})`,
            `Cost: ${cost}`,
            `Fee: ${fee}`,
            `Reduce Only: ${reduceOnly}`,
            `Created: ${timeString}`,
        ].filter(line => !line.includes(': N/A'));

        return toResult(`Order details:\n${details.join('\n')}`);
    } catch (error) {
        return toResult(`Error getting order details: ${error}`, true);
    }
}