import { erc20Abi, formatUnits, PublicClient } from 'viem';
import { boosterAbi } from '../abis';
import { Apy, Pool } from '../client';
import { CONVEX_BOOSTER_CONTRACT_ADDRESS, CONVEX_LP_TOKEN_DECIMALS } from '../constants';
import { to$$$ } from './format';

/**
 * How much does a user owns of a Convex LP token, both staked and unstaked
 */
export type ConvexLpTokenBalances = {
    staked: bigint; // Amount staked in reward pool earning rewards
    usdStaked?: number; // USD value of the staked amount
    unstaked: bigint; // Amount of deposit tokens in wallet (not staked)
    usdUnstaked?: number; // USD value of the unstaked amount
    total: bigint; // Total Convex LP token exposure
    usdTotal?: number; // USD value of the total amount
};

/**
 * Information about a Convex pool, returned by the Booster contract
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
 * All relevant info about a Convex LP token, including the API-returned
 * data, derived data, and the user's balances
 */
export type EnrichedConvexLpToken = {
    id: number;
    isBrokenOrShutdown: boolean;
    uiName: string;
    uiApy?: number;
    TVL: number | null;
    usdPrice: number;
    userBalances?: ConvexLpTokenBalances;
    curveLpId: string;
    curveLpName: string;
    curveLpTokenAddress: `0x${string}`;
    apiPool: Pool;
    apiApy?: Apy;
};

/**
 * Return all relevant info about a Convex LP token, starting from
 * the API-returned `pool` and `apy` objects (apy is optional).
 *
 * Optionally, pass the user account address to fetch the user balances.
 */
export async function enrichConvexLpToken(pool: Pool, provider: PublicClient, apy?: Apy, account?: `0x${string}`): Promise<EnrichedConvexLpToken> {
    // Compute base data
    const result: EnrichedConvexLpToken = {
        id: pool.convexPoolData.id,
        isBrokenOrShutdown: pool.isBroken || pool.convexPoolData.shutdown,
        uiName: getConvexLpTokenUiName(pool),
        TVL: pool.convexPoolData.usdTotal ?? null,
        usdPrice: await calculateConvexLpTokenUsdPrice(pool, provider),
        curveLpId: pool.id,
        curveLpName: pool.name,
        curveLpTokenAddress: pool.lpTokenAddress as `0x${string}`,
        apiPool: pool,
    };
    // Compute APY data if we have it
    if (apy) {
        result.apiApy = apy;
        result.uiApy = NaN;
    }
    // Compute full user balances if we have an account
    if (account) {
        const d = CONVEX_LP_TOKEN_DECIMALS;
        result.userBalances = await fetchConvexLpTokenBalances(provider, pool.convexPoolData.id, account);
        result.userBalances.usdStaked = Number(formatUnits(result.userBalances.staked, d)) * result.usdPrice;
        result.userBalances.usdUnstaked = Number(formatUnits(result.userBalances.unstaked, d)) * result.usdPrice;
        result.userBalances.usdTotal = Number(result.userBalances.usdStaked + result.userBalances.usdUnstaked);
    }
    return result;
}

/**
 * Calculate the USD price of a Convex LP token by dividing the TVL by the total supply
 */
export async function calculateConvexLpTokenUsdPrice(pool: Pool, provider: PublicClient): Promise<number> {
    const totalSupply = await provider.readContract({
        address: pool.convexPoolData.token,
        abi: erc20Abi,
        functionName: 'totalSupply',
    });
    const d = CONVEX_LP_TOKEN_DECIMALS;
    return pool.convexPoolData.usdTotal ? pool.convexPoolData.usdTotal / Number(formatUnits(totalSupply, d)) : NaN;
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
 * Gets from the blockchain the staked and unstaked LP token amounts
 * for a user in a specific Convex pool
 */
export async function fetchConvexLpTokenBalances(provider: PublicClient, poolId: number, account: `0x${string}`): Promise<ConvexLpTokenBalances> {
    // Get pool info first
    const poolInfo = await fetchPoolInfo(provider, poolId);

    // Get both balances in parallel using multicall for efficiency
    const [stakedBalance, unstakedBalance] = await provider.multicall({
        contracts: [
            {
                address: poolInfo.crvRewards,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [account],
            },
            {
                address: poolInfo.token,
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
 * Fetches pool information from the Booster contract
 */
export async function fetchPoolInfo(provider: PublicClient, poolId: number): Promise<PoolInfo> {
    const poolInfoRaw = (await provider.readContract({
        address: CONVEX_BOOSTER_CONTRACT_ADDRESS,
        abi: boosterAbi,
        functionName: 'poolInfo',
        args: [BigInt(poolId)],
    })) as any;

    return {
        lptoken: poolInfoRaw[0],
        token: poolInfoRaw[1],
        gauge: poolInfoRaw[2],
        crvRewards: poolInfoRaw[3],
        stash: poolInfoRaw[4],
        shutdown: poolInfoRaw[5],
    };
}

/**
 * Return a multiple line string with all data for the given Convex
 * LP pool; optionally, pass a string with the user token balance to show
 * it as well.
 */
export function formatConvexLpToken(convexLpToken: EnrichedConvexLpToken): string {
    let parts: string[] = [];
    parts.push(`Info on Convex LP token ${convexLpToken.uiName}:`);
    if (convexLpToken.userBalances) {
        const d = CONVEX_LP_TOKEN_DECIMALS;
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
    parts.push(` - Underlying LP on Curve: "${convexLpToken.curveLpName}" with address ${convexLpToken.curveLpTokenAddress}`);
    if (convexLpToken.isBrokenOrShutdown) {
        parts.push(` - ⚠️ Curve pool is either broken or shutdown!`);
    }
    return parts.join('\n');
}

/**
 * Return a single line string with the most important data for the given
 * Convex LP pool.
 */
export function formatConvexLpTokenShort(convexLpToken: EnrichedConvexLpToken): string {
    let parts: string[] = [];
    parts.push(`Convex LP token ${convexLpToken.uiName}`);
    parts.push(`with ID ${convexLpToken.id},`);
    parts.push(`underlying LP on Curve "${convexLpToken.curveLpName}",`);
    parts.push(`TVL ${convexLpToken.TVL ? to$$$(convexLpToken.TVL, 0, 0) : 'N/A'}`);
    if (convexLpToken.userBalances) {
        parts.push(`- you own ${formatUnits(convexLpToken.userBalances.total, CONVEX_LP_TOKEN_DECIMALS)}`);
        if (convexLpToken.userBalances.usdTotal) {
            parts.push(`(${to$$$(convexLpToken.userBalances.usdTotal)})`);
        }
    }
    return parts.filter(Boolean).join(' ');
}
