import { FunctionReturn, toResult } from '@heyanon/sdk';
import { FunctionOptionsWithExchange } from '../overrides';
import { getAccountMarginMode } from '../helpers/exchange';
import { bybit } from 'ccxt';

interface Props {
    marginMode: 'cross' | 'isolated' | 'portfolio';
}

/**
 * Set the margin mode for the entire account (affects all positions).
 * Note: On Bybit, margin mode is set at the account level, not per-market.
 *
 * @param {Object} props - The function input parameters
 * @param {string} props.marginMode - Margin mode: "cross", "isolated", or "portfolio"
 * @param {FunctionOptions} options HeyAnon SDK options
 * @returns {Promise<FunctionReturn>} The result of the margin mode change
 */
export async function setMarginMode({ marginMode }: Props, { exchange }: FunctionOptionsWithExchange): Promise<FunctionReturn> {
    try {
        // Validate margin mode
        const validModes = ['cross', 'isolated', 'portfolio'];
        if (!validModes.includes(marginMode)) {
            return toResult(`Invalid margin mode. Must be one of: ${validModes.join(', ')}`, true);
        }

        // Get current margin mode
        const currentMode = await getAccountMarginMode(exchange);
        
        if (currentMode === marginMode) {
            return toResult(`Account margin mode is already set to ${marginMode}`);
        }

        // Map HeyAnon margin modes to Bybit API values
        const bybitMarginMode = marginMode === 'cross' ? 'REGULAR_MARGIN' : 
                               marginMode === 'isolated' ? 'ISOLATED_MARGIN' : 
                               'PORTFOLIO_MARGIN';

        // Set the margin mode using Bybit's specific API
        const result = await (exchange as bybit).privatePostV5AccountSetMarginMode({
            marginMode: bybitMarginMode
        });

        if (result.retCode === 0) {
            return toResult(`Successfully changed account margin mode from ${currentMode} to ${marginMode}. This affects all your positions.`);
        } else {
            return toResult(`Failed to change margin mode: ${result.retMsg}`, true);
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Handle common error cases
        if (errorMessage.includes('margin') && errorMessage.includes('insufficient')) {
            return toResult(`Cannot change margin mode: insufficient margin. Please add more collateral or reduce position sizes.`, true);
        }
        if (errorMessage.includes('liquidation')) {
            return toResult(`Cannot change margin mode: would trigger liquidation. Please reduce position sizes first.`, true);
        }
        
        return toResult(`Error setting margin mode: ${errorMessage}`, true);
    }
}