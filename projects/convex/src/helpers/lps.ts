import { erc20Abi, PublicClient } from 'viem';
import { boosterAbi } from '../abis';
import { Pool } from '../client';
import { CONVEX_BOOSTER_CONTRACT_ADDRESS } from '../constants';
import { to$$$ } from './format';

export type LpTokenBalances = {
    staked: bigint; // Amount staked in reward pool earning rewards
    unstaked: bigint; // Amount of deposit tokens in wallet (not staked)
    total: bigint; // Total LP token exposure
};

export type PoolInfo = {
    lptoken: `0x${string}`; // The LP token deposited into Convex
    token: `0x${string}`; // The Convex deposit token (cvxLP token)
    gauge: `0x${string}`; // The Curve gauge address
    crvRewards: `0x${string}`; // The BaseRewardPool address where staking happens
    stash: `0x${string}`; // The stash contract for extra rewards
    shutdown: boolean; // Whether the pool is shutdown
};

/**
 * Name shown on the website UI for the given LP token.
 * This is given by the pool tokens symbols joined by a plus sign
 * e.g. https://d.pr/i/WoXJrD
 */
export function getLpUiName(pool: Pool): string {
    return pool.coins.map((coin) => coin.symbol).join('+');
}

/**
 * Gets the staked and unstaked LP token amounts for a user in a specific Convex pool
 */
export async function getLpTokenBalances(provider: PublicClient, poolId: number, account: `0x${string}`): Promise<LpTokenBalances> {
    // Get pool info first
    const poolInfo = await getPoolInfo(provider, poolId);

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

    const staked = stakedBalance.status === 'success' ? stakedBalance.result : 0n;
    const unstaked = unstakedBalance.status === 'success' ? unstakedBalance.result : 0n;
    const total = staked + unstaked;

    return {
        staked,
        unstaked,
        total,
    };
}

/**
 * Gets pool information from the Booster contract
 */
export async function getPoolInfo(provider: PublicClient, poolId: number): Promise<PoolInfo> {
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
export function formatLpToken(pool: Pool, userTokenBalance?: string): string {
    const TVL = pool.convexPoolData.usdTotal ? to$$$(pool.convexPoolData.usdTotal, 0, 0) : 'N/A';

    let parts: string[] = [];
    if (userTokenBalance) {
        parts.push(` - Your balance: ${userTokenBalance}`);
    }
    parts.push(`Curve LP token ${getLpUiName(pool)}:`);
    parts.push(` - Total TVL: ${TVL}`);
    parts.push(` - Underlying Curve LP: ${pool.name}`);
    parts.push(` - Alphanumeric ID: ${pool.id}`);
    parts.push(` - Numeric ID: ${pool.convexPoolData.id}`);
    return parts.join('\n');
}

/**
 * Return a single line string with the most important data for the given
 * Convex LP pool.
 */
export function formatLpTokenShort(pool: Pool, userTokenBalance?: string): string {
    const TVL = pool.convexPoolData.usdTotal ? to$$$(pool.convexPoolData.usdTotal, 0, 0) : 'N/A';
    let parts: string[] = [];
    parts.push(`LP token ${getLpUiName(pool)}`);
    parts.push(`with ID ${pool.convexPoolData.id},`);
    parts.push(`underlying Curve LP "${pool.name}",`);
    parts.push(`TVL ${TVL}`);
    if (userTokenBalance) {
        parts.push(`(you own ${userTokenBalance})`);
    }
    return parts.filter(Boolean).join(' ');
}
