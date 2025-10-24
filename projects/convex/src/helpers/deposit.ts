import { encodeFunctionData, parseUnits, erc20Abi, formatUnits, PublicClient } from 'viem';
import { FunctionOptions, EVM } from '@heyanon/sdk';
import { boosterAbi } from '../abis';
import { CONVEX_BOOSTER_CONTRACT_ADDRESS, CONVEX_TOKEN_DECIMALS } from '../constants';
import { BoosterPoolInfo, fetchBoosterPoolInfo } from './lps';

/**
 * Build the transactions to deposit the specified amount of Curve LP or
 * lending vault tokens into Convex and stake them.
 *
 * The amount is specified in decimals, e.g. 1.5 tokens rather than 1.5*10^18 wei.
 *
 * The address of the token to deposit is determined by the convexTokenId. Please
 * note that we refer to this address as the LP address, regardles of whether it's
 * a pool or a lending vault, because Convex Booster contract does not distinguish
 * between them.
 *
 * If the token allowance is enough, only the deposit transaction is returned.
 * Otherwise, two transactions are returned: one to approve the Booster contract
 * and one to deposit the tokens.
 *
 * The function will:
 * 1. Fetch pool/vault info from Booster contract to get the Curve LP token address
 * 2. Check user's balance of the Curve LP token
 * 3. Check/approve the Booster contract if needed
 * 4. Build the deposit transaction (deposit + stake in one call)
 *
 * This function does NOT make any calls to Convex or Curve API.
 *
 * Docs: https://docs.convexfinance.com/convexfinanceintegration/booster
 */
export async function buildDepositExactTokensTransactions(
    account: `0x${string}`,
    provider: PublicClient,
    convexTokenId: number,
    amount: string,
    { notify }: FunctionOptions,
): Promise<[EVM.types.TransactionParams[], BoosterPoolInfo]> {
    // Fetch pool/vault info from Booster contract
    await notify(`Fetching info from Convex...`);
    const poolInfo = await fetchBoosterPoolInfo(provider, convexTokenId);

    // Check if pool/vault is shutdown
    if (poolInfo.shutdown) {
        throw new Error(`Convex pool/vault ${convexTokenId} is shutdown and cannot accept deposits`);
    }

    // Compute the amount in wei
    const amountInWei = parseUnits(amount, CONVEX_TOKEN_DECIMALS);
    if (amountInWei === 0n) {
        throw new Error('Amount must be greater than 0');
    }

    await notify(`Checking your balance...`);

    // Check user balance of Curve LP token
    const balance = await provider.readContract({
        address: poolInfo.lptoken,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account],
    });

    if (balance < amountInWei) {
        throw new Error(
            `Not enough Curve tokens: you need ${amount} but you have ${formatUnits(balance, CONVEX_TOKEN_DECIMALS)}\n` +
                `Convex pool ID: ${convexTokenId}\n` +
                `You need to first deposit into the Curve pool or lending vault to get tokens.`,
        );
    }

    // Maybe approve Curve LP token to Booster contract
    const transactions: EVM.types.TransactionParams[] = [];
    await EVM.utils.checkToApprove({
        args: {
            account,
            target: poolInfo.lptoken,
            spender: CONVEX_BOOSTER_CONTRACT_ADDRESS,
            amount: amountInWei,
        },
        provider,
        transactions,
    });

    // Prepare deposit transaction
    // _stake = true means it will automatically stake in the rewards contract
    const tx: EVM.types.TransactionParams = {
        target: CONVEX_BOOSTER_CONTRACT_ADDRESS,
        data: encodeFunctionData({
            abi: boosterAbi,
            functionName: 'deposit',
            args: [BigInt(convexTokenId), amountInWei, true],
        }),
    };
    transactions.push(tx);

    return [transactions, poolInfo];
}
