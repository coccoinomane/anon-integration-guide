/**
 * This file contains utility functions to work with Convex LP tokens.
 *
 * A Convex LP token is a deposit/receipt token that the user receives
 * in exchange for depositing Curve liquidity (in the form of a Curve
 * LP token) on Convex.
 *
 * After obtaining a Convex LP token, it can then be further staked
 * on Convex to earn boosted CRV and (sometimes) CVX rewards; this
 * is the whole point of it.
 */

import { erc20Abi, formatUnits, PublicClient } from 'viem';
import { Apy, ConvexCurveClient, LendingVault, Pool } from '../client';
import { CONVEX_TOKEN_DECIMALS, CRV_TOKEN_ADDRESS, CVX_TOKEN_ADDRESS, MULTICALL_BATCH_SIZE } from '../constants';
import { to$$$ } from './format';
import { calculateConvexLvTokenUsdPrice, getConvexLvTokenUiName } from './vaults';
import { AprBreakdown, calculateConvexApr } from './apr';
import { getChainNameFromProvider } from './chains';

/**
 * How much does a user owns of a Convex LP or LV token, both staked and unstaked
 */
export type ConvexTokenBalances = {
    staked: bigint; // Amount staked in reward pool earning rewards
    usdStaked?: number; // USD value of the staked amount
    unstaked: bigint; // Amount of deposit tokens in wallet (not staked)
    usdUnstaked?: number; // USD value of the unstaked amount
    total: bigint; // Total Convex LP token exposure
    usdTotal?: number; // USD value of the total amount
};

/**
 * Information about a Convex pool, returned by the Booster contract
 * Please note that at the smart contract level, there is no difference
 * between a pool and a vault.
 */
export type PoolInfo = {
    lptoken: `0x${string}`; // The LP token deposited into Convex
    token: `0x${string}`; // The Convex deposit token (cvxLP token)
    gauge: `0x${string}`; // The Curve gauge address
    crvRewards: `0x${string}`; // The BaseRewardPool address where staking happens
    stash: `0x${string}`; // The stash contract for extra rewards
    shutdown: boolean; // Whether the pool is shutdown
};

/**
 * All relevant info about a Convex LP or LV token, including the API-returned
 * data, derived data, and the user's balances
 */
export type EnrichedConvexToken = {
    /** The type of token, either a Convex LP Token or Convex LV Token */
    type: 'LP' | 'LV';
    id: number;
    isBrokenOrShutdown: boolean;
    uiName: string;
    uiApr?: number;
    uiAprBreakdown?: AprBreakdown;
    uiApy?: number;
    TVL: number | null;
    usdPrice: number;
    userBalances?: ConvexTokenBalances;
    curveId: string;
    curveName: string;
    curveTokenAddress: `0x${string}`;
    /** The API-returned object, either a Pool or a LendingVault */
    apiObject: Pool | LendingVault;
    apiApy?: Apy;
};

/**
 * Return all relevant info about a Convex LP token, given
 * the API-returned `pool`
 *
 * Optionally:
 * - pass the user account address to fetch the user balances
 *   (takes 1 request to the blockchain)
 * - pass the APY object to compute the APR and APY (takes 1
 *   request to the blockchain)
 */
export async function enrichConvexToken(obj: Pool | LendingVault, provider: PublicClient, apy?: Apy, account?: `0x${string}`): Promise<EnrichedConvexToken> {
    // Determine the type of token
    let type: 'LP' | 'LV';
    if (isPool(obj)) {
        type = 'LP';
    } else if (isLendingVault(obj)) {
        type = 'LV';
    } else {
        throw new Error('Could not determine the type of token (LP or Lending vault)');
    }
    // Compute base data
    const lpTokenPrice = calculateTokenUsdPrice(obj);
    const result: EnrichedConvexToken = {
        type,
        id: obj.convexPoolData.id,
        isBrokenOrShutdown: isPool(obj) ? obj.isBroken || obj.convexPoolData.shutdown : obj.convexPoolData.shutdown,
        uiName: isPool(obj) ? getConvexLpTokenUiName(obj) : getConvexLvTokenUiName(obj),
        TVL: obj.convexPoolData.usdTotal ?? null,
        usdPrice: lpTokenPrice,
        curveId: obj.id,
        curveName: obj.name,
        curveTokenAddress: isPool(obj) ? obj.lpTokenAddress : obj.address,
        apiObject: obj,
    };
    // Compute APY data if we have it
    if (apy) {
        const chainName = getChainNameFromProvider(provider);
        const cvxPrice = await new ConvexCurveClient().cvxPrice(chainName);
        const tokenPrices = {
            [CRV_TOKEN_ADDRESS.toLowerCase()]: apy.crvPrice ?? 0,
            [CVX_TOKEN_ADDRESS.toLowerCase()]: cvxPrice ?? 0,
        };
        const aprResult = await calculateConvexApr({
            baseCrvApr: isPool(obj) ? obj.baseApy : apy.baseApy,
            poolId: obj.convexPoolData.id,
            tokenPrices,
            lpTokenPrice,
            provider,
            compoundingFrequency: 365,
        });
        console.log('aprResult', aprResult);
        result.apiApy = apy;
        result.uiApr = aprResult.totalAPR;
        result.uiAprBreakdown = aprResult;
        result.uiApy = aprResult.totalAPY;
    }
    // Compute full user balances if we have an account
    if (account) {
        result.userBalances = await fetchConvexTokenBalances(provider, obj, account, true);
    }
    return result;
}

/**
 * Calculate the USD price of a Convex LP token
 * by dividing the TVL by the total supply
 */
export function calculateConvexLpTokenUsdPrice(pool: Pool): number {
    const d = CONVEX_TOKEN_DECIMALS;
    const tvl = pool.usdTotal;
    const totalSupply = pool.totalSupply; // could fetch it from the blockchain, but it's in the API response
    return tvl ? tvl / Number(formatUnits(BigInt(totalSupply), d)) : NaN;
}

/**
 * Type guard to check if an object is a Pool
 * Discriminates based on the presence of the lpTokenAddress property
 */
export function isPool(poolOrVault: Pool | LendingVault): poolOrVault is Pool {
    return 'lpTokenAddress' in poolOrVault;
}

/**
 * Type guard to check if an object is a LendingVault
 * Discriminates based on the presence of the borrowed property
 */
export function isLendingVault(poolOrVault: Pool | LendingVault): poolOrVault is LendingVault {
    return 'borrowed' in poolOrVault;
}

/**
 * Calculate the USD price of a Convex token (LP or LV)
 * This is a unified helper that works for both Pool and LendingVault types
 */
export function calculateTokenUsdPrice(poolOrVault: Pool | LendingVault): number {
    if (isLendingVault(poolOrVault)) {
        return calculateConvexLvTokenUsdPrice(poolOrVault);
    } else {
        return calculateConvexLpTokenUsdPrice(poolOrVault);
    }
}

/**
 * Name shown on the website UI for the given LP token.
 * This is given by the pool tokens symbols joined by a plus sign
 * e.g. https://d.pr/i/WoXJrD
 */
export function getConvexLpTokenUiName(pool: Pool): string {
    return pool.coins.map((coin) => coin.symbol).join('+');
}

/**
 * Gets from the blockchain the staked and unstaked Convex LP or
 * LV token amounts for a user in a specific Convex pool
 */
export async function fetchConvexTokenBalances(
    provider: PublicClient,
    poolOrVault: Pool | LendingVault,
    account: `0x${string}`,
    getUsdValues: boolean = true,
): Promise<ConvexTokenBalances> {
    // Get both balances in parallel using multicall for efficiency
    const [stakedBalance, unstakedBalance] = await provider.multicall({
        contracts: [
            {
                address: poolOrVault.convexPoolData.crvRewards,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [account],
            },
            {
                address: poolOrVault.convexPoolData.token,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [account],
            },
        ],
    });

    if (stakedBalance.status !== 'success' || unstakedBalance.status !== 'success') {
        throw new Error('Could not fetch convex LP token balances');
    }

    const staked = stakedBalance.result;
    const unstaked = unstakedBalance.result;
    const total = staked + unstaked;

    const balances: ConvexTokenBalances = {
        staked,
        unstaked,
        total,
    };

    // Calculate USD values if requested
    if (getUsdValues) {
        const usdPrice = calculateTokenUsdPrice(poolOrVault);
        const d = CONVEX_TOKEN_DECIMALS;
        balances.usdStaked = Number(formatUnits(staked, d)) * usdPrice;
        balances.usdUnstaked = Number(formatUnits(unstaked, d)) * usdPrice;
        balances.usdTotal = balances.usdStaked + balances.usdUnstaked;
    }

    return balances;
}

/**
 * Fetches balances for multiple pools and vaults in batched multicalls.
 * Returns a Map indexed by the Convex pool ID for easy lookup.
 *
 * This is much more efficient than calling fetchConvexTokenBalances in a loop
 * when you need balances for many pools/vaults at once.
 *
 * The function automatically batches requests to avoid RPC provider limits.
 */
export async function fetchMultipleConvexTokenBalances(
    provider: PublicClient,
    poolsAndVaults: (Pool | LendingVault)[],
    account: `0x${string}`,
    getUsdValues: boolean = true,
): Promise<Map<number, ConvexTokenBalances>> {
    if (poolsAndVaults.length === 0) {
        return new Map();
    }

    // Build contracts array: for each pool/vault we need 2 calls (staked + unstaked)
    const contracts = poolsAndVaults.flatMap((poolOrVault) => [
        {
            address: poolOrVault.convexPoolData.crvRewards,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account],
        } as const,
        {
            address: poolOrVault.convexPoolData.token,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account],
        } as const,
    ]);

    // Split contracts into batches to avoid RPC provider limits
    const batches: (typeof contracts)[] = [];
    for (let i = 0; i < contracts.length; i += MULTICALL_BATCH_SIZE) {
        batches.push(contracts.slice(i, i + MULTICALL_BATCH_SIZE));
    }

    // Execute all batches in parallel
    const batchResults = await Promise.all(batches.map((batch) => provider.multicall({ contracts: batch })));

    // Flatten all batch results into a single array
    const results = batchResults.flat();

    // Parse results and build the map
    const balancesMap = new Map<number, ConvexTokenBalances>();

    for (let i = 0; i < poolsAndVaults.length; i++) {
        const poolOrVault = poolsAndVaults[i];
        const stakedResult = results[i * 2];
        const unstakedResult = results[i * 2 + 1];

        // Skip this pool/vault if either call failed
        if (stakedResult.status !== 'success' || unstakedResult.status !== 'success') {
            console.warn(`Failed to fetch balances for Convex pool ID ${poolOrVault.convexPoolData.id}`);
            continue;
        }

        const staked = stakedResult.result;
        const unstaked = unstakedResult.result;
        const total = staked + unstaked;

        const balances: ConvexTokenBalances = {
            staked,
            unstaked,
            total,
        };

        // Calculate USD values if requested
        if (getUsdValues) {
            const usdPrice = calculateTokenUsdPrice(poolOrVault);
            const d = CONVEX_TOKEN_DECIMALS;
            balances.usdStaked = Number(formatUnits(staked, d)) * usdPrice;
            balances.usdUnstaked = Number(formatUnits(unstaked, d)) * usdPrice;
            balances.usdTotal = balances.usdStaked + balances.usdUnstaked;
        }

        balancesMap.set(poolOrVault.convexPoolData.id, balances);
    }

    return balancesMap;
}

/**
 * Return a multiple line string with all data for the given Convex LP token
 */
export function formatConvexLpToken(convexLpToken: EnrichedConvexToken): string {
    let parts: string[] = [];
    parts.push(`Info on Convex LP token ${convexLpToken.uiName}:`);
    if (convexLpToken.userBalances) {
        const d = CONVEX_TOKEN_DECIMALS;
        const subParts: string[] = [];
        subParts.push(` - Your balance: ${formatUnits(convexLpToken.userBalances.total, d)} LP`);
        if (convexLpToken.userBalances.usdTotal) {
            subParts.push(` (${to$$$(convexLpToken.userBalances.usdTotal)})`);
        }
        if (convexLpToken.userBalances.unstaked) {
            subParts.push(` of which ${formatUnits(convexLpToken.userBalances.unstaked, d)}`);
            if (convexLpToken.userBalances.usdUnstaked) {
                subParts.push(` (${to$$$(convexLpToken.userBalances.usdUnstaked)})`);
            }
            subParts.push(` is unstaked`);
        }
        parts.push(subParts.join(''));
    }
    parts.push(` - Total TVL: ${convexLpToken.TVL ? to$$$(convexLpToken.TVL, 0, 0) : 'N/A'}`);
    parts.push(` - Total APR: ${typeof convexLpToken.uiApr === 'number' && convexLpToken.uiApr >= 0 ? `${convexLpToken.uiApr.toFixed(2)}%` : 'N/A'}`);
    if (convexLpToken.uiApr && convexLpToken.uiAprBreakdown) {
        parts.push(` - APR breakdown: ${convexLpToken.uiAprBreakdown.breakdown.map((b) => `${b.tokenSymbol}: ${b.apr.toFixed(3)}%`).join(', ')}`);
    }
    parts.push(` - Convex ID: ${convexLpToken.id}`);
    parts.push(` - Underlying LP on Curve: "${convexLpToken.curveName}" with address ${convexLpToken.curveTokenAddress}`);
    if (convexLpToken.isBrokenOrShutdown) {
        parts.push(` - ⚠️ Pool is either broken or shutdown!`);
    }
    return parts.join('\n');
}

/**
 * Return a single line string with the most important data for the given
 * Convex LP pool.
 */
export function formatConvexLpTokenShort(convexLpToken: EnrichedConvexToken): string {
    let parts: string[] = [];
    parts.push(`Convex LP token ${convexLpToken.uiName}`);
    parts.push(`with ID ${convexLpToken.id},`);
    parts.push(`underlying LP on Curve "${convexLpToken.curveName}",`);
    parts.push(`TVL ${convexLpToken.TVL ? to$$$(convexLpToken.TVL, 0, 0) : 'N/A'}`);
    parts.push(`, Total APR: ${convexLpToken.uiApr && convexLpToken.uiApr >= 0 ? `${convexLpToken.uiApr.toFixed(2)}%` : 'N/A'}`);
    if (convexLpToken.userBalances) {
        parts.push(`- you own ${formatUnits(convexLpToken.userBalances.total, CONVEX_TOKEN_DECIMALS)}`);
        if (convexLpToken.userBalances.usdTotal) {
            parts.push(`(${to$$$(convexLpToken.userBalances.usdTotal)})`);
        }
    }
    return parts.filter(Boolean).join(' ');
}
