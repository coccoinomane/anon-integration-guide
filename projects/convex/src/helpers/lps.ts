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
import { Apy, LendingVault, Pool } from '../client';
import { CONVEX_TOKEN_DECIMALS } from '../constants';
import { to$$$ } from './format';

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
 * the API-returned `pool` and `apy` objects (apy is optional).
 *
 * Optionally, pass the user account address to fetch the user balances.
 */
export async function enrichConvexLpToken(pool: Pool, provider: PublicClient, apy?: Apy, account?: `0x${string}`): Promise<EnrichedConvexToken> {
    // Compute base data
    const result: EnrichedConvexToken = {
        type: 'LP',
        id: pool.convexPoolData.id,
        isBrokenOrShutdown: pool.isBroken || pool.convexPoolData.shutdown,
        uiName: getConvexLpTokenUiName(pool),
        TVL: pool.convexPoolData.usdTotal ?? null,
        usdPrice: calculateConvexLpTokenUsdPrice(pool),
        curveId: pool.id,
        curveName: pool.name,
        curveTokenAddress: pool.lpTokenAddress as `0x${string}`,
        apiObject: pool,
    };
    // Compute APY data if we have it
    if (apy) {
        result.apiApy = apy;
        result.uiApy = NaN;
    }
    // Compute full user balances if we have an account
    if (account) {
        const d = CONVEX_TOKEN_DECIMALS;
        result.userBalances = await fetchConvexTokenBalances(provider, pool, account);
        result.userBalances.usdStaked = Number(formatUnits(result.userBalances.staked, d)) * result.usdPrice;
        result.userBalances.usdUnstaked = Number(formatUnits(result.userBalances.unstaked, d)) * result.usdPrice;
        result.userBalances.usdTotal = Number(result.userBalances.usdStaked + result.userBalances.usdUnstaked);
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
export async function fetchConvexTokenBalances(provider: PublicClient, poolOrVault: Pool | LendingVault, account: `0x${string}`): Promise<ConvexTokenBalances> {
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

    return {
        staked,
        unstaked,
        total,
    };
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
    if (convexLpToken.userBalances) {
        parts.push(`- you own ${formatUnits(convexLpToken.userBalances.total, CONVEX_TOKEN_DECIMALS)}`);
        if (convexLpToken.userBalances.usdTotal) {
            parts.push(`(${to$$$(convexLpToken.userBalances.usdTotal)})`);
        }
    }
    return parts.filter(Boolean).join(' ');
}
