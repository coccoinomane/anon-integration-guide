import { EVM, EvmChain, FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { MIN_TVL, N_MAX_RESULTS_IN_BEST_YIELD, supportedChains } from '../constants';
import { ConvexCurveClient, LendingVault, Pool } from '../client';
import { enrichConvexToken, EnrichedConvexToken, formatConvexTokenShort, isPool, shouldIncludePosition } from '../helpers/poolAndVaults';
import { toTitleCase } from '../helpers/format';

interface Props {
    chainName: string;
    tokenSymbol: string;
    positionTypes: ('LP' | 'LV')[] | null;
}

/**
 * Show Convex pools and vaults sorted by APR yield.  The user balance
 * will be shown, too.
 *
 * Optionally, specify the position types to include in the result (
 * (by default, both LP and LV are included).
 *
 * To sort the pool/vaults by APR, rather than checking the APR of
 * every single one on-chain, we use the APR returned by Convex/Curve
 * API.
 */
export async function getBestYieldOpportunitiesForUnderlyingToken(
    { chainName, tokenSymbol, positionTypes }: Props,
    { evm: { getProvider, getAddress } }: FunctionOptions,
): Promise<FunctionReturn> {
    // Validate and sanitize the position types
    let types = positionTypes ?? ['LP', 'LV'];
    for (const type of types) {
        if (type !== 'LP' && type !== 'LV') {
            return toResult(`Invalid position type: ${type}. Valid types are "LP" for liquidity pools and "LV" for lending vaults`, true);
        }
    }
    if (types.length === 0) return toResult('Select at least one position type to show: "LP" for liquidity pools and "LV" for lending vaults', true);
    types = [...new Set(types)];

    // Chain validation
    const chainId = EVM.utils.getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Unsupported chain: ${chainName}`, true);

    // Get clients
    const account = await getAddress();
    const provider = getProvider(chainId);
    const client = new ConvexCurveClient();

    // Select the pools and vaults that need to be considered,
    // filtering out unsafe ones, and keeping only those whose
    // coins/assets names include the given token symbol
    const poolsAndVaults: (Pool | LendingVault)[] = [];
    if (types.includes('LP')) {
        let pools = await client.pools(chainName);
        pools = pools.filter((pool) => shouldIncludePosition(pool, MIN_TVL));
        pools = pools.filter((pool) => pool.coins.some((coin) => coin.symbol.toLowerCase().includes(tokenSymbol.toLowerCase())));
        poolsAndVaults.push(...pools);
    }
    if (types.includes('LV')) {
        let vaults = await client.lendingVaults(chainName);
        vaults = vaults.filter((vault) => shouldIncludePosition(vault, MIN_TVL));
        // For lending vaults, we only consider the collateral symbol
        vaults = vaults.filter((vault) => vault.assets.collateral.symbol.toLowerCase().includes(tokenSymbol.toLowerCase()));
        poolsAndVaults.push(...vaults);
    }

    // If no poor or vault found, return early
    if (poolsAndVaults.length === 0) {
        return toResult(`No pools or lending vaults found on Convex with '${tokenSymbol}' as underlying token on ${toTitleCase(chainName)} chain`);
    }

    // Sort by APR.  Rather than fetching APRs on-chain, which is
    // time consuming for many pools, we use the APR contained
    // in the API response.
    const apys = await client.apys(chainName);
    poolsAndVaults.sort((a, b) => {
        const aValue = isPool(a) ? a.baseApy + apys[a.id]?.crvApy : a.rates.lendApyPcent + apys[a.id]?.crvApy;
        const bValue = isPool(b) ? b.baseApy + apys[b.id]?.crvApy : b.rates.lendApyPcent + apys[b.id]?.crvApy;
        return bValue - aValue;
    });

    // Initial message
    const nFound = poolsAndVaults.length;
    const firstNOpportunities = poolsAndVaults.slice(0, N_MAX_RESULTS_IN_BEST_YIELD);
    const parts: string[] = [];
    parts.push(`Found ${nFound} opportunit${nFound > 1 ? 'ies' : 'y'} with '${tokenSymbol}' as underlying token on ${chainName} chain`);
    if (nFound > N_MAX_RESULTS_IN_BEST_YIELD) {
        parts[parts.length - 1] += `. Showing only the top ${N_MAX_RESULTS_IN_BEST_YIELD}`;
    }
    parts[parts.length - 1] += ':';

    // Enrich the opportunities
    const enrichedOpportunities: EnrichedConvexToken[] = [];
    for (const poolOrVault of firstNOpportunities) {
        // Get user balance but do not get claimable rewards
        const enriched = await enrichConvexToken(poolOrVault, provider, apys[poolOrVault.id], account, false);
        enrichedOpportunities.push(enriched);
    }

    // Re-sort opportunities, this time with accurate APR
    enrichedOpportunities.sort((a, b) => {
        const aValue = a.uiApr ?? 0;
        const bValue = b.uiApr ?? 0;
        return bValue - aValue;
    });

    // List the opportunities
    enrichedOpportunities.forEach((opportunity, index) => parts.push(`${index + 1}. ${formatConvexTokenShort(opportunity)}`));

    return toResult(parts.join('\n'));
}
