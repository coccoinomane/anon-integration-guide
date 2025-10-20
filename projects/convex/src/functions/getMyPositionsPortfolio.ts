import { EVM, EvmChain, FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { MIN_TVL, supportedChains, CONVEX_TOKEN_DECIMALS } from '../constants';
import { ConvexCurveClient, LendingVault, Pool } from '../client';
import { enrichConvexToken, EnrichedConvexToken, fetchMultipleConvexTokenBalances, formatConvexLpTokenShort } from '../helpers/lps';
import { formatConvexLvTokenShort } from '../helpers/vaults';
import { formatUnits } from 'viem';
import { to$$$ } from '../helpers/format';

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
    // filtering out those with low TVL or those which are either
    // broken or shutdown
    const poolAndVaults: (Pool | LendingVault)[] = [];
    if (types.includes('LP')) {
        const pools = await client.pools(chainName);
        poolAndVaults.push(...pools.filter((pool) => pool.convexPoolData.usdTotal >= minTvl && !pool.isBroken && !pool.convexPoolData.shutdown));
    }
    if (types.includes('LV')) {
        const vaults = await client.lendingVaults(chainName);
        poolAndVaults.push(...vaults.filter((vault) => vault.convexPoolData.usdTotal >= minTvl && !vault.convexPoolData.shutdown));
    }

    // Fetch all balances in a single efficient multicall
    const balancesMap = await fetchMultipleConvexTokenBalances(provider, poolAndVaults, account, true);

    // Filter to only pools/vaults where the user has a non-zero balance
    const poolsAndVaultsWithBalance = poolAndVaults.filter((poolOrVault) => {
        const balance = balancesMap.get(poolOrVault.convexPoolData.id);
        return balance && balance.total > 0n;
    });

    // If no positions found, return early
    if (poolsAndVaultsWithBalance.length === 0) {
        return toResult('You have no active positions on Convex for the selected criteria.');
    }

    // Fetch Convex APYs across pools and vaults
    const apys = await client.apys(chainName);

    // Build enriched tokens for all positions with balances
    const enrichedTokens: EnrichedConvexToken[] = [];
    for (const poolOrVault of poolsAndVaultsWithBalance) {
        const apy = apys[poolOrVault.id];
        const balance = balancesMap.get(poolOrVault.convexPoolData.id);

        // No account specified as we already fetched the balances
        const enriched = await enrichConvexToken(poolOrVault, provider, apy);
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

    // Format the output
    const lines: string[] = [];
    lines.push(`Your Convex Portfolio on ${chainName}:`);
    lines.push(`Total Value: ${to$$$(totalUsdValue)}`);
    lines.push(`Number of Positions: ${enrichedTokens.length}`);
    lines.push('');
    lines.push('Positions:');

    enrichedTokens.forEach((token, index) => {
        const balance = token.userBalances!;
        const d = CONVEX_TOKEN_DECIMALS;
        lines.push(`${index + 1}. ${token.type === 'LP' ? formatConvexLpTokenShort(token) : formatConvexLvTokenShort(token)}`);
        lines.push(`   Balance: ${formatUnits(balance.total, d)} tokens (${to$$$(balance.usdTotal ?? 0)})`);
        if (balance.staked > 0n) {
            lines.push(`   - Staked: ${formatUnits(balance.staked, d)} (${to$$$(balance.usdStaked ?? 0)}) - earning rewards`);
        }
        if (balance.unstaked > 0n) {
            lines.push(`   - Unstaked: ${formatUnits(balance.unstaked, d)} (${to$$$(balance.usdUnstaked ?? 0)}) - not earning rewards`);
        }
    });

    return toResult(lines.join('\n'));
}
