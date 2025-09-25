import { FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { PendleClient } from '../helpers/client';
import { MIN_LIQUIDITY_FOR_MARKET, MAX_LIQUIDITY_POOLS_IN_RESULTS } from '../constants';
import { getChainIdFromChainName } from '../helpers/chains';
import { toTitleCase } from '../helpers/format';
import { formatMarketCompactData } from '../helpers/markets';

interface Props {
    chainName: string;
    filterTokenSymbol: string | null;
}

export async function getLiquidityPoolsWithHighestApy({ chainName, filterTokenSymbol }: Props, { notify }: FunctionOptions): Promise<FunctionReturn> {
    // Get all active markets
    await notify(`Fetching liquidity pools on ${chainName}...`);
    const pendleClient = new PendleClient();
    const chainId = getChainIdFromChainName(chainName);
    let markets = await pendleClient.getActiveMarkets(chainId);

    // Optionally filter by token symbol
    if (filterTokenSymbol) {
        markets = markets.filter((m) => m.name.toLowerCase().includes(filterTokenSymbol.toLowerCase()));
    }
    // Filter out low liquidity markets
    const filteredMarkets = markets.filter((m) => m.details.liquidity > MIN_LIQUIDITY_FOR_MARKET);
    // Sort markets by APY
    const sortedMarkets = filteredMarkets.sort((a, b) => b.details.aggregatedApy - a.details.aggregatedApy);
    // Get the top N markets
    const firstNMarkets = sortedMarkets.slice(0, MAX_LIQUIDITY_POOLS_IN_RESULTS);

    // Build and return output string
    const parts = [
        `Highest-APY pools on ${toTitleCase(chainName)}${filterTokenSymbol ? ` with '${filterTokenSymbol}' in their name` : ''}:`,
        `${firstNMarkets
            .map((m, i) => `${i + 1}. ${formatMarketCompactData(m)}`)
            .filter(Boolean)
            .join('\n')}`,
    ];
    return toResult(parts.filter(Boolean).join('\n'));
}
