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
 */
export async function getClaimableRewards(
    provider: PublicClient,
    rewardPoolAddress: `0x${string}`,
    userAddress: `0x${string}`,
    includeExtraRewards: boolean = false,
): Promise<ClaimableRewards> {
    // Read base reward info in a single multicall (earned CRV + extra rewards length)
    const baseRewardsResults = await provider.multicall({
        contracts: [
            {
                address: rewardPoolAddress,
                abi: baseRewardPoolAbi,
                functionName: 'earned',
                args: [userAddress],
            },
            {
                address: rewardPoolAddress,
                abi: baseRewardPoolAbi,
                functionName: 'extraRewardsLength',
            },
        ],
        allowFailure: true,
    });

    const earnedCrvCall = baseRewardsResults[0];
    const extraRewardsLengthCall = baseRewardsResults[1];

    if (earnedCrvCall.status !== 'success' || extraRewardsLengthCall.status !== 'success') {
        throw new Error('Failed to fetch base reward information');
    }

    const earnedCrv = earnedCrvCall.result as bigint;
    const extraRewardsLength = extraRewardsLengthCall.result as bigint;

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
        const rewardsCount = Number(extraRewardsLength);
        const extraRewards: ClaimableRewards['extraRewards'] = [];

        if (rewardsCount > 0) {
            // Fetch all extra reward pool addresses in one batch
            const extraRewardPoolAddressResults = await provider.multicall({
                contracts: Array.from({ length: rewardsCount }, (_, index) => ({
                    address: rewardPoolAddress,
                    abi: baseRewardPoolAbi,
                    functionName: 'extraRewards',
                    args: [BigInt(index)],
                })),
                allowFailure: true,
            });

            const extraRewardPoolAddresses: `0x${string}`[] = [];

            for (const result of extraRewardPoolAddressResults) {
                if (result.status !== 'success') {
                    throw new Error('Failed to fetch extra reward pool address');
                }
                extraRewardPoolAddresses.push(result.result as `0x${string}`);
            }

            // Fetch reward token + earned amount for each extra reward pool with a single multicall
            const rewardDataResults = await provider.multicall({
                contracts: extraRewardPoolAddresses.flatMap((extraRewardPoolAddress) => [
                    {
                        address: extraRewardPoolAddress,
                        abi: baseRewardPoolAbi,
                        functionName: 'rewardToken',
                    },
                    {
                        address: extraRewardPoolAddress,
                        abi: baseRewardPoolAbi,
                        functionName: 'earned',
                        args: [userAddress],
                    },
                ]),
                allowFailure: true,
            });

            const rewardTokenAddresses: `0x${string}`[] = [];
            const earnedAmounts: bigint[] = [];

            for (let i = 0; i < extraRewardPoolAddresses.length; i++) {
                const rewardTokenCall = rewardDataResults[i * 2];
                const earnedCall = rewardDataResults[i * 2 + 1];

                if (rewardTokenCall.status !== 'success' || earnedCall.status !== 'success') {
                    throw new Error('Failed to fetch extra reward token data');
                }

                const rewardToken = rewardTokenCall.result as `0x${string}`;
                const earnedExtra = earnedCall.result as bigint;

                rewardTokenAddresses.push(rewardToken);
                earnedAmounts.push(earnedExtra);
            }

            if (rewardTokenAddresses.length > 0) {
                // Fetch all token symbols & decimals in one multicall
                const tokenMetadataResults = await provider.multicall({
                    contracts: rewardTokenAddresses.flatMap((tokenAddress) => [
                        {
                            address: tokenAddress,
                            abi: erc20Abi,
                            functionName: 'symbol',
                        },
                        {
                            address: tokenAddress,
                            abi: erc20Abi,
                            functionName: 'decimals',
                        },
                    ]),
                    allowFailure: true,
                });

                for (let i = 0; i < rewardTokenAddresses.length; i++) {
                    const rewardToken = rewardTokenAddresses[i];
                    const earnedExtra = earnedAmounts[i];
                    const symbolCall = tokenMetadataResults[i * 2];
                    const decimalsCall = tokenMetadataResults[i * 2 + 1];

                    if (symbolCall.status !== 'success' || decimalsCall.status !== 'success') {
                        throw new Error(`Failed to fetch metadata for reward token ${rewardToken}`);
                    }

                    const symbol = symbolCall.result as string;
                    const decimalsRaw = decimalsCall.result as number | bigint;
                    const decimals = typeof decimalsRaw === 'bigint' ? Number(decimalsRaw) : decimalsRaw;

                    if (!Number.isInteger(decimals)) {
                        throw new Error(`Invalid decimals value for reward token ${rewardToken}`);
                    }

                    if (earnedExtra > 0n) {
                        extraRewards.push({
                            token: rewardToken,
                            symbol,
                            decimals,
                            amount: earnedExtra,
                            formatted: formatUnits(earnedExtra, decimals),
                        });
                    }
                }
            }
        }

        result.extraRewards = extraRewards;
    }

    return result;
}

/**
 * Format the claimable rewards into a human-readable string
 * with the CRV, CVX and extra rewards
 */
export function formatClaimableRewards(rewards: ClaimableRewards): string {
    let parts: string[] = [];
    if (rewards.crv > 0n) {
        parts.push(`${rewards.crvFormatted} CRV`);
    }
    if (rewards.cvx > 0n) {
        parts.push(`${rewards.cvxFormatted} CVX`);
    }
    if (rewards.extraRewards && rewards.extraRewards.length > 0) {
        rewards.extraRewards.forEach((r) => {
            if (r.amount > 0n) {
                parts.push(`${r.formatted} ${r.symbol}`);
            }
        });
    }
    return parts.join(', ');
}
