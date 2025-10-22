import { FunctionReturn, FunctionOptions, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { supportedChains } from '../constants';
import { buildDepositExactTokensTransactions } from '../helpers/deposit';

interface Props {
    chainName: string;
    convexTokenId: number;
    amount: string;
}

/**
 * Deposit and stake on Convex the specified amount of Curve LP or
 * vault tokens
 *
 * The tokens are automatically staked in the rewards contract
 * to earn CRV, CVX, and other rewards.
 */
export async function depositExactTokens({ chainName, convexTokenId, amount }: Props, options: FunctionOptions): Promise<FunctionReturn> {
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

    // Build the transactions that need to be sent
    let transactions: EVM.types.TransactionParams[] = [];
    try {
        [transactions] = await buildDepositExactTokensTransactions(account, provider, convexTokenId, amount, options);
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
    return toResult(`Successfully deposited ${amount} Curve tokens into Convex pool ${convexTokenId} and staked them to earn rewards. ${message}`);
}
