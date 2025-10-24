import { FunctionReturn, FunctionOptions, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { formatUnits, encodeFunctionData } from 'viem';
import { CONVEX_TOKEN_DECIMALS as d, supportedChains } from '../constants';
import { BoosterPoolInfo, fetchBoosterPoolInfo, fetchConvexTokenBalances } from '../helpers/lps';
import { toHumanReadableAmount } from '../helpers/format';
import { baseRewardPoolAbi } from '../abis/baseRewardPoolAbi';

interface Props {
    chainName: string;
    convexTokenId: number;
    removalPercentage: number | null;
}

/**
 * Withdraw the given percentage of the user's deposited tokens
 * from a Convex pool or vault. Omit the percentage to withdraw all of the
 * user's tokens.
 *
 * Please note that:
 * - You can withdraw from shutdown pool/vaults
 * - This function does NOT make any calls to Convex or Curve API.
 *
 * Docs: https://docs.convexfinance.com/convexfinanceintegration/baserewardpool
 */
export async function withdraw({ chainName, convexTokenId, removalPercentage }: Props, options: FunctionOptions): Promise<FunctionReturn> {
    // Default values
    removalPercentage = removalPercentage ?? 100;

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
    if (userBalance.total === 0n) {
        return toResult(`You have no balance in this pool/vault (Convex ID: ${convexTokenId})`);
    }

    // Compute the amount to withdraw
    // TODO: For the time being, we only support withdrawing & unwrapping staked tokens
    // which means that the % refers to the staked amount
    const amountToWithdrawInWei = removalPercentage === 100 ? userBalance.staked : (userBalance.staked * BigInt(Math.round(removalPercentage * 100000))) / 10000000n;

    await notify(
        `Will withdraw ${removalPercentage}% of your Curve tokens (${toHumanReadableAmount(amountToWithdrawInWei, d)}) from Convex pool ${convexTokenId}.  Any existing reward will be claimed too.`,
    );

    const transactions: EVM.types.TransactionParams[] = [];

    // Prepare withdraw transaction
    const tx: EVM.types.TransactionParams = {
        target: poolInfo.crvRewards,
        data: encodeFunctionData({
            abi: baseRewardPoolAbi,
            functionName: removalPercentage === 100 ? 'withdrawAllAndUnwrap' : 'withdrawAndUnwrap',
            args: removalPercentage === 100 ? [true] : [amountToWithdrawInWei, true],
        }),
    };
    transactions.push(tx);

    // Send the transactions
    const result = await sendTransactions({ chainId, account, transactions });
    const message = result.data[result.data.length - 1].message;
    return toResult(
        `Successfully withdrew ${removalPercentage}% of your Curve tokens (${formatUnits(amountToWithdrawInWei, d)} LP) from Convex pool ${convexTokenId}. Any existing rewards were claimed, too. ${message}`,
    );
}
