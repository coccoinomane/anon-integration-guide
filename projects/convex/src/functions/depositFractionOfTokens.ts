import { FunctionReturn, FunctionOptions, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { supportedChains, CONVEX_TOKEN_DECIMALS } from '../constants';
import { buildDepositExactTokensTransactions } from '../helpers/deposit';
import { erc20Abi, formatUnits } from 'viem';
import { toHumanReadableAmount } from '../helpers/format';
import { BoosterPoolInfo, fetchBoosterPoolInfo } from '../helpers/booster';

interface Props {
    chainName: string;
    convexTokenId: number;
    percentage: number;
}

/**
 * Deposit a percentage of the user's Curve LP tokens into a Convex pool
 * or vault and automatically stake them to earn rewards.
 *
 * This is useful for commands like "Deposit half of my Curve liquidity
 * into Convex pool 41".
 *
 * Please note that:
 * - The deposited tokens are automatically staked in the rewards contract
 *   to earn CRV, CVX, and other rewards.
 * - This function does NOT make any calls to Convex or Curve API.
 *
 * Docs: https://docs.convexfinance.com/convexfinanceintegration/booster
 *
 * @param {Object} props - The function input parameters
 * @param {string} props.chainName - Name of the blockchain network
 * @param {number} props.convexTokenId - The Convex pool/vault ID (e.g., 25 for the frxETH/ETH pool)
 * @param {number} props.percentage - The percentage of the user's tokens to deposit (0-100, e.g., 50 for 50%)
 * @param {FunctionOptions} options - Holds EVM utilities and a notifier
 * @returns {Promise<FunctionReturn>} A message confirming the deposit or an error description
 */
export async function depositFractionOfTokens({ chainName, convexTokenId, percentage }: Props, options: FunctionOptions): Promise<FunctionReturn> {
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

    // Validate percentage
    if (percentage <= 0 || percentage > 100) {
        return toResult(`Percentage must be greater than 0 and at most 100`, true);
    }

    // Get pool info
    let poolInfo: BoosterPoolInfo;
    try {
        poolInfo = await fetchBoosterPoolInfo(provider, convexTokenId);
    } catch (error) {
        return toResult(`Could not fetch pool info for Convex pool ${convexTokenId}: ${error instanceof Error ? error.message : 'An unknown error occurred'}`, true);
    }

    // Get user's balance
    let userBalance: bigint;
    try {
        userBalance = await provider.readContract({
            address: poolInfo.lptoken,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account],
        });
    } catch (error) {
        return toResult(`Could not fetch user balance for Convex pool ${convexTokenId}: ${error instanceof Error ? error.message : 'An unknown error occurred'}`, true);
    }

    // Calculate amount to deposit
    const amountToDepositInWei = percentage === 100 ? userBalance : (userBalance * BigInt(Math.round(percentage * 100000))) / 10000000n;
    const amountToDeposit = formatUnits(amountToDepositInWei, CONVEX_TOKEN_DECIMALS);

    await notify(`Will deposit ${percentage}% of your Curve tokens (${toHumanReadableAmount(amountToDepositInWei, CONVEX_TOKEN_DECIMALS)}) into Convex pool ${convexTokenId}`);

    // Build the transactions that need to be sent
    let transactions: EVM.types.TransactionParams[] = [];
    try {
        [transactions] = await buildDepositExactTokensTransactions(account, provider, convexTokenId, amountToDeposit, options);
    } catch (error) {
        return toResult(`Could not build deposit transactions for Convex pool ${convexTokenId}: ${error instanceof Error ? error.message : 'An unknown error occurred'}`, true);
    }

    if (transactions.length === 1) {
        await notify('Sending deposit transaction...');
    } else if (transactions.length > 1) {
        await notify('Sending approval & deposit transactions...');
    }

    // Send the transactions
    const result = await sendTransactions({ chainId, account, transactions });
    const message = result.data[result.data.length - 1].message;
    return toResult(
        `Successfully deposited ${amountToDeposit} Curve tokens (${percentage}% of your balance) into Convex pool ${convexTokenId} and staked them to earn rewards. ${message}`,
    );
}
