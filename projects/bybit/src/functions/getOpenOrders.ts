import { FunctionReturn, toResult } from '@heyanon/sdk';
import { FunctionOptionsWithExchange } from '../overrides';
import { getMarketObject } from '../helpers/markets';
import { formatDate, extractTimestamp } from '../helpers/format';

interface Props {
    currency: string | null;
    market: string | null;
}

/**
 * Get all open orders for the user.
 *
 * @param {Object} props - The function input parameters
 * @param {string|null} props.currency - Optionally, specify a currency to filter orders, e.g. "BTC"
 * @param {string|null} props.market - Optionally, specify a market to filter orders, e.g. "BTC/USDT"
 * @param {FunctionOptions} options HeyAnon SDK options
 * @returns {Promise<FunctionReturn>} The open orders for the user
 */
export async function getOpenOrders({ currency, market }: Props, { exchange }: FunctionOptionsWithExchange): Promise<FunctionReturn> {
    try {
        // Fetch open orders
        let orders;
        if (market) {
            // Verify market exists
            await getMarketObject(exchange, market);
            orders = await exchange.fetchOpenOrders(market);
        } else {
            orders = await exchange.fetchOpenOrders();
        }

        // Filter by currency if specified
        if (currency && !market) {
            orders = orders.filter(order => 
                order.symbol.includes(currency.toUpperCase())
            );
        }

        if (orders.length === 0) {
            if (market) {
                return toResult(`You have no open orders on ${market}`);
            } else if (currency) {
                return toResult(`You have no open orders for ${currency}`);
            } else {
                return toResult('You have no open orders');
            }
        }

        // Format orders for display
        const orderSummaries = orders.map(order => {
            const timestamp = extractTimestamp(order);
            const timeString = timestamp ? formatDate(timestamp) : 'N/A';
            const price = order.price ? ` @ ${order.price} ${order.symbol.split('/')[1]?.split(':')[0]}` : '';
            const triggerPrice = order.triggerPrice ? ` (trigger: ${order.triggerPrice})` : '';
            const reduceOnly = order.reduceOnly ? ' [reduce-only]' : '';
            const filled = order.filled && order.filled > 0 ? ` (${((order.filled / order.amount) * 100).toFixed(1)}% filled)` : '';
            
            return `- Order ${order.id}: ${order.type} ${order.side} ${order.amount} ${order.symbol}${price}${triggerPrice}${reduceOnly}${filled} - ${order.status} (${timeString})`;
        });

        const title = market 
            ? `Your open orders on ${market}:`
            : currency 
                ? `Your open orders for ${currency}:`
                : 'Your open orders:';

        return toResult(`${title}\n${orderSummaries.join('\n')}`);
    } catch (error) {
        return toResult(`Error getting open orders: ${error}`, true);
    }
}