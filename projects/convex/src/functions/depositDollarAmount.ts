import { FunctionReturn, FunctionOptions, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { CONVEX_TOKEN_DECIMALS, supportedChains } from '../constants';
import { buildDepositExactTokensTransactions } from '../helpers/deposit';
import { ConvexCurveClient, LendingVault, Pool } from '../client';
import { calculateTokenUsdPrice } from '../helpers/lps';
import { to$$$ } from '../helpers/format';
import Big from 'big.js';

interface Props {
    chainName: string;
    convexTokenId: number;
    dollarAmount: number;
}

/**
 * Deposit and stake Curve LP tokens into a Convex pool or vault for the USD
 * value specified in `dollarAmount`. The pool/vault is identified by its
 * Convex ID.
 *
 * The function will convert the dollar amount to the exact number of Curve LP
 * tokens to deposit based on the current token price, then deposit and stake
 * them in the rewards contract to earn CRV, CVX, and other rewards.
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
 * @param {number} props.dollarAmount - The USD value of tokens to deposit
 * @param {FunctionOptions} options - Holds EVM utilities and a notifier
 * @returns {Promise<FunctionReturn>} A message confirming the deposit or an error description
 */
export async function depositDollarAmount({ chainName, convexTokenId, dollarAmount }: Props, options: FunctionOptions): Promise<FunctionReturn> {
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

    // Fetch pool/vault info from Convex API to get the token price
    await notify(`Fetching pool info from Convex API...`);
    const poolOrVault = await findConvexToken(chainName, convexTokenId);
    if (!poolOrVault) {
        return toResult(`Could not find Convex pool or vault with ID ${convexTokenId}`, true);
    }

    // Get the USD price of the Curve LP token
    const tokenUsdPrice = calculateTokenUsdPrice(poolOrVault);
    if (!tokenUsdPrice || tokenUsdPrice <= 0) {
        return toResult(`Could not determine USD price for Convex pool/vault ${convexTokenId}`, true);
    }

    // Calculate the amount of tokens to deposit
    const amount = dollarAmount / tokenUsdPrice;
    const amountStr = new Big(dollarAmount).div(tokenUsdPrice).toFixed(CONVEX_TOKEN_DECIMALS);
    await notify(`Will attempt to deposit ${to$$$(dollarAmount, 2, 6)} worth of Curve tokens in Convex pool ${convexTokenId} (${amount.toFixed(6)} tokens).`);

    // Build the transactions that need to be sent
    let transactions: EVM.types.TransactionParams[] = [];
    try {
        [transactions] = await buildDepositExactTokensTransactions(account, provider, convexTokenId, amountStr, options);
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
        `Successfully deposited ${to$$$(dollarAmount, 2, 6)} worth of Curve tokens in Convex pool ${convexTokenId} (${amount.toFixed(6)} tokens) and staked them to earn rewards. ${message}`,
    );
}

/**
 * Find a Convex token by its ID
 */
async function findConvexToken(chainName: string, convexTokenId: number): Promise<Pool | LendingVault | null> {
    const client = new ConvexCurveClient();
    const pools = await client.pools(chainName);
    const pool = pools.find((p) => p.convexPoolData.id === convexTokenId);
    if (pool) return pool;

    const vaults = await client.lendingVaults(chainName);
    const vault = vaults.find((v) => v.convexPoolData.id === convexTokenId);
    if (vault) return vault;

    return null;
}
