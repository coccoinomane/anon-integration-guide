/**
 * This file contains utility functions to fetch the balances of
 * Convex tokens.
 */

import { PublicClient, formatUnits, erc20Abi } from 'viem';
import { ConvexTokenBalances, calculateTokenUsdPrice, isPool } from './poolAndVaults';
import { Pool, LendingVault } from '../client';
import { CONVEX_TOKEN_DECIMALS, MULTICALL_BATCH_SIZE } from '../constants';
import { BoosterPoolInfo } from './booster';

/**
 * Given the output of the poolInfo method on the Booster smart
 * contract, return the balance of the user for the pool (or vault).
 */
export async function fetchConvexTokenBalances(provider: PublicClient, poolInfo: BoosterPoolInfo, account: `0x${string}`): Promise<ConvexTokenBalances> {
    // Get the balances in parallel using multicall for efficiency
    const [stakedBalance, unstakedBalance, underlyingBalance] = await provider.multicall({
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
            {
                address: poolInfo.lptoken,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [account],
            },
        ],
    });

    if (stakedBalance.status !== 'success' || unstakedBalance.status !== 'success' || underlyingBalance.status !== 'success') {
        throw new Error('Could not fetch Convex token balances');
    }

    const staked = stakedBalance.result;
    const unstaked = unstakedBalance.result;
    const total = staked + unstaked;
    const underlying = underlyingBalance.result;

    return {
        staked,
        unstaked,
        total,
        underlying,
    };
}

/**
 * Given a pool or lending vault object, return the balance of the user
 * for that pool or lending vault; includes USD values if requested.
 *
 * The balance will include:
 * - staked amount in Convex
 * - unstaked amount in Convex
 * - underlying amount in Curve token
 */
export async function fetchConvexTokenBalancesFromApiObject(
    provider: PublicClient,
    poolOrVault: Pool | LendingVault,
    account: `0x${string}`,
    getUsdValues: boolean = true,
): Promise<ConvexTokenBalances> {
    // Underlying Curve LP or Vault tokens in wallet
    const underlyingAddress = isPool(poolOrVault) ? poolOrVault.lpTokenAddress : poolOrVault.address;

    // Get both balances in parallel using multicall for efficiency
    const [stakedBalance, unstakedBalance, underlyingBalance] = await provider.multicall({
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
            {
                address: underlyingAddress,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [account],
            },
        ],
    });

    if (stakedBalance.status !== 'success' || unstakedBalance.status !== 'success' || underlyingBalance.status !== 'success') {
        throw new Error('Could not fetch Convex token balances');
    }

    const staked = stakedBalance.result;
    const unstaked = unstakedBalance.result;
    const total = staked + unstaked;
    const underlying = underlyingBalance.result;

    const balances: ConvexTokenBalances = {
        staked,
        unstaked,
        total,
        underlying,
    };

    // Calculate USD values if requested
    if (getUsdValues) {
        const usdPrice = calculateTokenUsdPrice(poolOrVault);
        const d = CONVEX_TOKEN_DECIMALS;
        balances.usdStaked = Number(formatUnits(staked, d)) * usdPrice;
        balances.usdUnstaked = Number(formatUnits(unstaked, d)) * usdPrice;
        balances.usdTotal = balances.usdStaked + balances.usdUnstaked;
        balances.usdUnderlying = Number(formatUnits(underlying, d)) * usdPrice;
    }

    return balances;
}

/**
 * Fetches balances for multiple pools and vaults in batched multicalls.
 * Returns a Map indexed by the Convex pool ID for easy lookup.
 *
 * This is much more efficient than calling fetchConvexTokenBalancesFromApiObject in a loop
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

    // Build contracts array: for each pool/vault we need 3 calls (staked + unstaked + underlying)
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
        {
            address: isPool(poolOrVault) ? poolOrVault.lpTokenAddress : poolOrVault.address,
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
        const stakedResult = results[i * 3];
        const unstakedResult = results[i * 3 + 1];
        const underlyingResult = results[i * 3 + 2];

        // Skip this pool/vault if either call failed
        if (stakedResult.status !== 'success' || unstakedResult.status !== 'success' || underlyingResult.status !== 'success') {
            console.warn(`Failed to fetch balances for Convex pool ID ${poolOrVault.convexPoolData.id}`);
            continue;
        }

        const staked = stakedResult.result;
        const unstaked = unstakedResult.result;
        const total = staked + unstaked;
        const underlying = underlyingResult.result;

        const balances: ConvexTokenBalances = {
            staked,
            unstaked,
            total,
            underlying,
        };

        // Calculate USD values if requested
        if (getUsdValues) {
            const usdPrice = calculateTokenUsdPrice(poolOrVault);
            const d = CONVEX_TOKEN_DECIMALS;
            balances.usdStaked = Number(formatUnits(staked, d)) * usdPrice;
            balances.usdUnstaked = Number(formatUnits(unstaked, d)) * usdPrice;
            balances.usdTotal = balances.usdStaked + balances.usdUnstaked;
            balances.usdUnderlying = Number(formatUnits(underlying, d)) * usdPrice;
        }

        balancesMap.set(poolOrVault.convexPoolData.id, balances);
    }

    return balancesMap;
}
