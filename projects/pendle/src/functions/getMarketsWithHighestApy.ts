import { FunctionOptions, FunctionReturn, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { PendleClient } from '../helpers/client';
import { MIN_LIQUIDITY_FOR_MARKET, MAX_MARKETS_IN_RESULTS, supportedChains } from '../constants';
import { toTitleCase } from '../helpers/format';
import { formatMarketCompactDataWithImpliedApy } from '../helpers/markets';

interface Props {
    chainName: string;
    filterTokenSymbol: string | null;
}

const { getChainFromName } = EVM.utils;

export async function getMarketsWithHighestApy({ chainName, filterTokenSymbol }: Props, { notify }: FunctionOptions): Promise<FunctionReturn> {
    // Validation
    const chainId = getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Pendle is not supported on ${chainName}`, true);

    // Get all active markets
    await notify(`Fetching markets on ${chainName}...`);
    const pendleClient = new PendleClient();
    let markets = await pendleClient.getActiveMarkets(chainId);

    // Optionally filter by token symbol
    if (filterTokenSymbol) {
        markets = markets.filter((m) => m.name.toLowerCase().includes(filterTokenSymbol.toLowerCase()));
    }
    // Filter out low liquidity markets
    const filteredMarkets = markets.filter((m) => m.details.liquidity > MIN_LIQUIDITY_FOR_MARKET);
    // Sort markets by implied APY
    const sortedMarkets = filteredMarkets.sort((a, b) => b.details.impliedApy - a.details.impliedApy);
    // Get the top N markets
    const firstNMarkets = sortedMarkets.slice(0, MAX_MARKETS_IN_RESULTS);

    // Build and return output string
    const parts = [
        `Highest-APY markets on ${toTitleCase(chainName)}${filterTokenSymbol ? ` with '${filterTokenSymbol}' in their name` : ''}:`,
        `${firstNMarkets
            .map((m, i) => `${i + 1}. ${formatMarketCompactDataWithImpliedApy(m)}`)
            .filter(Boolean)
            .join('\n')}`,
    ];
    return toResult(parts.filter(Boolean).join('\n'));
}
