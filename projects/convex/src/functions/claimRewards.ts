import { FunctionReturn, FunctionOptions, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { encodeFunctionData } from 'viem';
import { supportedChains } from '../constants';
import { BoosterPoolInfo, fetchBoosterPoolInfo } from '../helpers/booster';
import { baseRewardPoolAbi } from '../abis';
import { getClaimableRewards } from '../helpers/rewards';

interface Props {
    chainName: string;
    convexTokenId: number;
}

/**
 * Claim CRV and CVX rewards earned from staking in a Convex pool or vault.
 *
 * This function claims:
 * - CRV rewards (earned from the pool)
 * - CVX rewards (automatically minted as bonus when CRV is claimed)
 * - Extra rewards (e.g. FXS, SPELL, etc. - depends on the pool)
 *
 * Please note that:
 * - This function does NOT make any calls to Convex or Curve API.
 *
 * Docs: https://docs.convexfinance.com/convexfinanceintegration/baserewardpool
 */
export async function claimRewards({ chainName, convexTokenId }: Props, options: FunctionOptions): Promise<FunctionReturn> {
    // Validate chain
    const chainId = EVM.utils.getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Convex protocol is not supported on ${chainName}`, true);

    // Check wallet connection
    const account = await options.evm.getAddress();
    const {
        notify,
        evm: { getProvider, sendTransactions },
    } = options;
    const provider = getProvider(chainId);

    // Fetch pool/vault info from Booster contract
    await notify(`Fetching info from Convex...`);
    let poolInfo: BoosterPoolInfo;
    try {
        poolInfo = await fetchBoosterPoolInfo(provider, convexTokenId);
    } catch (error) {
        return toResult(`Could not fetch info on Convex pool/vault ${convexTokenId}: ${error instanceof Error ? error.message : 'An unknown error occurred'}`, true);
    }

    // Check if user has any claimable rewards
    await notify(`Checking your claimable rewards...`);
    let claimableRewards;
    try {
        claimableRewards = await getClaimableRewards(provider, poolInfo.crvRewards, account, true);
    } catch (error) {
        return toResult(`Could not fetch claimable rewards: ${error instanceof Error ? error.message : 'An unknown error occurred'}`, true);
    }

    // Check if there are any rewards to claim
    const hasMainRewards = claimableRewards.crv > 0n || claimableRewards.cvx > 0n;
    const hasExtraRewards = claimableRewards.extraRewards && claimableRewards.extraRewards.some((r) => r.amount > 0n);

    if (!hasMainRewards && !hasExtraRewards) {
        return toResult(`You have no claimable rewards from pool ${convexTokenId}. Make sure you have staked tokens in this pool to earn rewards.`);
    }

    // Build reward summary message
    const rewardParts: string[] = [];
    if (claimableRewards.crv > 0n) {
        rewardParts.push(`${claimableRewards.crvFormatted} CRV`);
    }
    if (claimableRewards.cvx > 0n) {
        rewardParts.push(`${claimableRewards.cvxFormatted} CVX`);
    }
    if (claimableRewards.extraRewards && claimableRewards.extraRewards.length > 0) {
        claimableRewards.extraRewards.forEach((r) => {
            if (r.amount > 0n) {
                rewardParts.push(`${r.formatted} ${r.symbol}`);
            }
        });
    }

    await notify(`Will claim ${rewardParts.join(', ')} from Convex pool ${convexTokenId}`);

    // Prepare claim transaction
    const tx: EVM.types.TransactionParams = {
        target: poolInfo.crvRewards,
        data: encodeFunctionData({
            abi: baseRewardPoolAbi,
            functionName: 'getReward',
            args: [account, true], // Always claim extra rewards
        }),
    };

    // Send the transaction
    const result = await sendTransactions({ chainId, account, transactions: [tx] });
    const message = result.data[result.data.length - 1].message;

    const successMsg = `Successfully claimed ${rewardParts.join(', ')} from Convex pool ${convexTokenId}. ${message}`;
    return toResult(successMsg);
}
