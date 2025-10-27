/**
 * Functions to fetch claimable rewards from Convex staking positions
 */

import { PublicClient, formatUnits, erc20Abi } from 'viem';
import { baseRewardPoolAbi } from '../abis/baseRewardPoolAbi';
import { cvxMiningAbi } from '../abis/cvxMiningAbi';
import { CVX_MINING_CONTRACT_ADDRESS } from '../constants';

export interface ClaimableRewards {
    crv: bigint; // Claimable CRV in wei
    cvx: bigint; // Claimable CVX in wei
    crvFormatted: string; // Human-readable CRV amount
    cvxFormatted: string; // Human-readable CVX amount
    extraRewards?: Array<{
        token: `0x${string}`;
        symbol: string;
        decimals: number;
        amount: bigint;
        formatted: string;
    }>;
}

/**
 * Fetch the amount of claimable CRV, CVX and extra tokens
 * rewards for a user's staked position in a specific Convex
 * pool/vault.
 *
 * TODO: Use multicall to reduce the number of calls
 */
export async function getClaimableRewards(
    provider: PublicClient,
    rewardPoolAddress: `0x${string}`,
    userAddress: `0x${string}`,
    includeExtraRewards: boolean = false,
): Promise<ClaimableRewards> {
    // Get claimable CRV from BaseRewardPool.earned()
    const earnedCrv = (await provider.readContract({
        address: rewardPoolAddress,
        abi: baseRewardPoolAbi,
        functionName: 'earned',
        args: [userAddress],
    })) as bigint;

    // Convert CRV to CVX using the CVX mining contract
    const earnedCvx = (await provider.readContract({
        address: CVX_MINING_CONTRACT_ADDRESS,
        abi: cvxMiningAbi,
        functionName: 'ConvertCrvToCvx',
        args: [earnedCrv],
    })) as bigint;

    const result: ClaimableRewards = {
        crv: earnedCrv,
        cvx: earnedCvx,
        crvFormatted: formatUnits(earnedCrv, 18),
        cvxFormatted: formatUnits(earnedCvx, 18),
    };

    // Optionally get extra rewards (other tokens like FXS, SPELL, etc.)
    if (includeExtraRewards) {
        const extraRewardsLength = (await provider.readContract({
            address: rewardPoolAddress,
            abi: baseRewardPoolAbi,
            functionName: 'extraRewardsLength',
        })) as bigint;

        const extraRewards: ClaimableRewards['extraRewards'] = [];

        for (let i = 0; i < Number(extraRewardsLength); i++) {
            const extraRewardPoolAddress = (await provider.readContract({
                address: rewardPoolAddress,
                abi: baseRewardPoolAbi,
                functionName: 'extraRewards',
                args: [BigInt(i)],
            })) as `0x${string}`;

            // Get the reward token address
            const rewardToken = (await provider.readContract({
                address: extraRewardPoolAddress,
                abi: baseRewardPoolAbi,
                functionName: 'rewardToken',
            })) as `0x${string}`;

            // Get the reward token symbol
            const rewardSymbol = (await provider.readContract({
                address: rewardToken,
                abi: erc20Abi,
                functionName: 'symbol',
            })) as string;

            // Get the reward token decimals
            const rewardTokenDecimals = (await provider.readContract({
                address: rewardToken,
                abi: erc20Abi,
                functionName: 'decimals',
            })) as number;

            // Get earned amount for this extra reward
            const earnedExtra = (await provider.readContract({
                address: extraRewardPoolAddress,
                abi: baseRewardPoolAbi,
                functionName: 'earned',
                args: [userAddress],
            })) as bigint;

            if (earnedExtra > 0n) {
                extraRewards.push({
                    token: rewardToken,
                    symbol: rewardSymbol,
                    decimals: rewardTokenDecimals,
                    amount: earnedExtra,
                    formatted: formatUnits(earnedExtra, rewardTokenDecimals),
                });
            }
        }

        result.extraRewards = extraRewards;
    }

    return result;
}
