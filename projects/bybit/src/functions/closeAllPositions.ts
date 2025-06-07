import { FunctionReturn, toResult } from '@heyanon/sdk';
import { FunctionOptionsWithExchange } from '../overrides';

interface Props {
    currency: string | null;
}

/**
 * Close all open positions, optionally filtered by currency.
 *
 * @param {Object} props - The function input parameters
 * @param {string|null} props.currency - Optionally, specify a currency to close only positions for that currency, e.g. "BTC"
 * @param {FunctionOptions} options HeyAnon SDK options
 * @returns {Promise<FunctionReturn>} The result of the position closures
 */
export async function closeAllPositions({ currency }: Props, { exchange }: FunctionOptionsWithExchange): Promise<FunctionReturn> {
    try {
        // Get all positions
        const positions = await exchange.fetchPositions();
        const openPositions = positions.filter(p => p.contracts && p.contracts > 0);

        // Filter by currency if specified
        let positionsToClose = openPositions;
        if (currency) {
            positionsToClose = openPositions.filter(p => 
                p.symbol.includes(currency.toUpperCase())
            );
        }

        if (positionsToClose.length === 0) {
            return toResult(currency 
                ? `No open positions found for ${currency}`
                : 'No open positions to close'
            );
        }

        const results = [];
        let successCount = 0;
        let errorCount = 0;

        // Close each position
        for (const position of positionsToClose) {
            try {
                const oppositeSide = position.side === 'long' ? 'sell' : 'buy';
                const order = await exchange.createOrder(
                    position.symbol,
                    'market',
                    oppositeSide,
                    position.contracts!,
                    undefined,
                    { reduceOnly: true }
                );

                results.push(`✓ Closed ${position.side} position on ${position.symbol} (Order ID: ${order.id})`);
                successCount++;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                results.push(`✗ Failed to close ${position.side} position on ${position.symbol}: ${errorMessage}`);
                errorCount++;
            }
        }

        // Format summary
        let summary = currency 
            ? `Closed ${successCount} position(s) for ${currency}`
            : `Closed ${successCount} position(s)`;
            
        if (errorCount > 0) {
            summary += ` (${errorCount} failed)`;
        }

        const fullResult = `${summary}:\n${results.join('\n')}`;
        
        return toResult(fullResult, errorCount > 0);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return toResult(`Error closing positions: ${errorMessage}`, true);
    }
}