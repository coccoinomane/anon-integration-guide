import { EVM, EvmChain, FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { CONVEX_TOKEN_DECIMALS, N_MAX_RESULTS_IN_PORTFOLIO, MIN_TVL, supportedChains } from '../constants';
import { ConvexCurveClient, LendingVault, Pool } from '../client';
import { enrichConvexToken, EnrichedConvexToken, fetchMultipleConvexTokenBalances, shouldIncludePosition } from '../helpers/lps';
import { to$$$, toTitleCase } from '../helpers/format';
import { formatUnits } from 'viem';

interface Props {
    chainName: string;
    positionTypes: ('LP' | 'LV')[] | null;
    minTvl: number | null;
}

export async function getMyPositionsPortfolio({ chainName, positionTypes, minTvl }: Props, { evm: { getProvider, getAddress } }: FunctionOptions): Promise<FunctionReturn> {
    // Default value for the minimum TVL
    minTvl = minTvl ?? MIN_TVL;

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

    // Get provider and account
    const provider = getProvider(chainId);
    const account = await getAddress();

    // Create Convex API client
    const client = new ConvexCurveClient();

    // Select the pools and vaults that need to be processed,
    // filtering out those with low TVL or those to be excluded
    // according to the criteria in the `shouldIncludePosition` function
    const poolsAndVaults: (Pool | LendingVault)[] = [];
    if (types.includes('LP')) {
        const pools = await client.pools(chainName);
        poolsAndVaults.push(...pools.filter((pool) => shouldIncludePosition(pool, minTvl)));
    }
    if (types.includes('LV')) {
        const vaults = await client.lendingVaults(chainName);
        poolsAndVaults.push(...vaults.filter((vault) => shouldIncludePosition(vault, minTvl)));
    }

    // Fetch all balances in a single efficient multicall
    const balancesMap = await fetchMultipleConvexTokenBalances(provider, poolsAndVaults, account, true);

    // Filter to only pools/vaults where the user has a non-zero balance
    const poolsAndVaultsWithBalance = poolsAndVaults.filter((poolOrVault) => {
        const balance = balancesMap.get(poolOrVault.convexPoolData.id);
        return balance && balance.total > 0n;
    });

    // If no positions found, return early
    if (poolsAndVaultsWithBalance.length === 0) {
        return toResult(`You do not seem to have active positions on Convex ${chainName} chain`);
    }

    // Fetch Convex APYs across pools and vaults
    const apys = await client.apys(chainName);

    // Build enriched tokens for all positions with balances
    const enrichedTokens: EnrichedConvexToken[] = [];
    for (const poolOrVault of poolsAndVaultsWithBalance) {
        const balance = balancesMap.get(poolOrVault.convexPoolData.id);
        // No account specified as we already fetched the balances
        const enriched = await enrichConvexToken(poolOrVault, provider, apys[poolOrVault.id], undefined);
        enriched.userBalances = balance;
        enrichedTokens.push(enriched);
    }

    // Sort by USD value (highest first)
    enrichedTokens.sort((a, b) => {
        const aValue = a.userBalances?.usdTotal ?? 0;
        const bValue = b.userBalances?.usdTotal ?? 0;
        return bValue - aValue;
    });

    // Calculate total portfolio value
    const totalUsdValue = enrichedTokens.reduce((sum, token) => sum + (token.userBalances?.usdTotal ?? 0), 0);

    // Initial message
    const nPositions = enrichedTokens.length;
    const firstNPositions = enrichedTokens.slice(0, N_MAX_RESULTS_IN_PORTFOLIO);
    const parts: string[] = [];
    parts.push(`You have ${nPositions} position${nPositions > 1 ? 's' : ''} in your Convex Portfolio on ${chainName}, for a total value of ${to$$$(totalUsdValue)}`);
    if (nPositions > N_MAX_RESULTS_IN_PORTFOLIO) {
        parts[parts.length - 1] += `. Showing only the top ${N_MAX_RESULTS_IN_PORTFOLIO} positions`;
    }
    parts[parts.length - 1] += ':';

    // List the positions
    firstNPositions.forEach((ct, index) => {
        let subParts: string[] = [];
        const balance = ct.userBalances!;
        const d = CONVEX_TOKEN_DECIMALS;
        const usdValue = balance.usdTotal ? to$$$(balance.usdTotal) : 'N/A';
        const unstaked = balance.unstaked > 0n ? formatUnits(balance.unstaked, d) : 'N/A';
        subParts.push(`${index + 1}.`);
        subParts.push(` ${usdValue}`);
        subParts.push(` in Convex ${ct.typeLabel} "${ct.uiName}"`);
        subParts.push(`, ${formatUnits(balance.total, d)} ${ct.type === 'LP' ? 'LP' : 'vault'} tokens`);
        if (balance.unstaked > 0n) {
            subParts.push(` (of which ${unstaked} unstaked)`);
        }
        subParts.push(` earning ${ct.uiApr?.toFixed(2)}% APR`);
        if (ct.isBrokenOrShutdownOrKilled) {
            subParts.push(` ⚠️ ${toTitleCase(ct.typeLabelShort)} may not be active anymore`);
        }
        parts.push(subParts.join(''));
    });

    return toResult(parts.join('\n'));
}
