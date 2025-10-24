import { FunctionReturn, FunctionOptions, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { formatUnits, encodeFunctionData } from 'viem';
import { CONVEX_BOOSTER_CONTRACT_ADDRESS, CONVEX_TOKEN_DECIMALS as d, supportedChains } from '../constants';
import { BoosterPoolInfo, fetchBoosterPoolInfo } from '../helpers/booster';
import { toHumanReadableAmount } from '../helpers/format';
import { baseRewardPoolAbi } from '../abis/baseRewardPoolAbi';
import { boosterAbi } from '../abis';
import { fetchConvexTokenBalances } from '../helpers/balances';

interface Props {
    chainName: string;
    convexTokenId: number;
    removalPercentage: number | null;
    withdrawUnstaked: boolean | null;
}

/**
 * Withdraw the given percentage of the user's deposited tokens
 * from a Convex pool or vault. Omit the percentage to withdraw all of the
 * user's tokens.
 *
 * Please note that:
 * - By default, the function will unstake & withdraw staked tokens.
 * - If `withdrawUnstaked` is true, the function will withdraw
 *   unstaked tokens, instead.
 * - You can withdraw from shutdown pool/vaults
 * - This function does NOT make any calls to Convex or Curve API.
 *
 * Docs: https://docs.convexfinance.com/convexfinanceintegration/baserewardpool
 */
export async function withdraw({ chainName, convexTokenId, removalPercentage, withdrawUnstaked }: Props, options: FunctionOptions): Promise<FunctionReturn> {
    // Default values
    removalPercentage = removalPercentage ?? 100;
    withdrawUnstaked = withdrawUnstaked ?? false;
    const withdrawStaked = !withdrawUnstaked;

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

    // Validate removal percentage
    if (removalPercentage <= 0 || removalPercentage > 100) {
        return toResult(`Removal percentage must be greater than 0 and at most 100`, true);
    }

    // Fetch pool/vault info from Booster contract
    await notify(`Fetching info from Convex...`);
    let poolInfo: BoosterPoolInfo;
    try {
        poolInfo = await fetchBoosterPoolInfo(provider, convexTokenId);
    } catch (error) {
        return toResult(`Could not fetch info on Convex pool/vault ${convexTokenId}: ${error instanceof Error ? error.message : 'An unknown error occurred'}`, true);
    }

    // Get info on what the user holds in the given pool/vault
    await notify(`Checking your balance...`);
    const userBalance = await fetchConvexTokenBalances(provider, poolInfo, account);

    // Compute the amount to withdraw, depending on whether the user
    // wants to withdraw staked or unstaked tokens
    let amountToWithdrawInWei = 0n;
    if (withdrawStaked) {
        if (userBalance.staked === 0n) {
            let msg = `You have no staked balance to withdraw from this pool/vault (Convex ID: ${convexTokenId}).`;
            if (userBalance.unstaked > 0n) {
                msg += ` However, you do have ${formatUnits(userBalance.unstaked, d)} unstaked balance; do you want to withdraw it?`;
            }
            return toResult(msg);
        }
        amountToWithdrawInWei = removalPercentage === 100 ? userBalance.staked : (userBalance.staked * BigInt(Math.round(removalPercentage * 100000))) / 10000000n;
    }
    if (withdrawUnstaked) {
        if (userBalance.unstaked === 0n) {
            let msg = `You have no unstaked balance to withdraw from this pool/vault (Convex ID: ${convexTokenId}).`;
            if (userBalance.staked > 0n) {
                msg += ` However, you do have ${formatUnits(userBalance.staked, d)} staked balance; do you want to withdraw it?`;
            }
            return toResult(msg);
        }
        amountToWithdrawInWei = removalPercentage === 100 ? userBalance.unstaked : (userBalance.unstaked * BigInt(Math.round(removalPercentage * 100000))) / 10000000n;
    }

    await notify(
        `Will withdraw ${removalPercentage}% of your ${withdrawStaked ? 'staked' : 'unstaked'} Curve tokens (${toHumanReadableAmount(amountToWithdrawInWei, d)}) from Convex pool ${convexTokenId}.  Any existing reward will be claimed too.`,
    );

    const transactions: EVM.types.TransactionParams[] = [];

    // Prepare withdraw transaction
    let tx: EVM.types.TransactionParams;
    if (withdrawStaked) {
        // If withdrawing staked tokens, we need to use the the BaseRewardPoll
        // contract to unstake them and, after that, withdraw the LP tokens
        // from the Booster contract (aka unwrap).  This can be accomplished in
        // one call thanks to the withdrawAndUnwrap method (see
        // https://docs.convexfinance.com/convexfinanceintegration/baserewardpool).
        tx = {
            target: poolInfo.crvRewards,
            data: encodeFunctionData({
                abi: baseRewardPoolAbi,
                functionName: removalPercentage === 100 ? 'withdrawAllAndUnwrap' : 'withdrawAndUnwrap',
                args: removalPercentage === 100 ? [true] : [amountToWithdrawInWei, true],
            }),
        };
    } else {
        tx = {
            target: CONVEX_BOOSTER_CONTRACT_ADDRESS,
            data: encodeFunctionData({
                abi: boosterAbi,
                functionName: removalPercentage === 100 ? 'withdrawAll' : 'withdraw',
                args: removalPercentage === 100 ? [BigInt(convexTokenId)] : [BigInt(convexTokenId), amountToWithdrawInWei],
            }),
        };
    }
    transactions.push(tx);

    // Send the transactions
    const result = await sendTransactions({ chainId, account, transactions });
    const message = result.data[result.data.length - 1].message;
    let msg = `Successfully withdrew ${removalPercentage}% of your ${withdrawStaked ? 'staked' : 'unstaked'} tokens (${formatUnits(amountToWithdrawInWei, d)} LP) from Convex pool ${convexTokenId}. Any existing rewards were claimed, too. ${message}`;
    if (withdrawStaked && userBalance.unstaked > 0n) {
        msg += `\nPlease note that you also have ${formatUnits(userBalance.unstaked, d)} unstaked tokens that you could withdraw from this pool.`;
    }
    if (withdrawUnstaked && userBalance.staked > 0n) {
        msg += `\nPlease note that you also have ${formatUnits(userBalance.staked, d)} staked tokens that you could withdraw from this pool.`;
    }
    return toResult(msg);
}
