import { erc20Abi, formatUnits, parseUnits } from 'viem';
import { FunctionOptions, FunctionReturn, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { ConvertResponse, PendleApiError, PendleClient } from '../helpers/client';
import { fetchTokenInfoFromAddress } from '../helpers/tokens';
import { DEFAULT_SLIPPAGE_TOLERANCE, PENDLE_NATIVE_TOKEN_ADDRESS, supportedChains } from '../constants';

interface Props {
    chainName: string;
    marketAddress: `0x${string}`;
    tokenInAddress: `0x${string}`;
    tokenInAmount: number;
    slippageTolerance: number | null;
}

const { checkToApprove, getChainFromName } = EVM.utils;

export async function addLiquidityToMarketPool(
    { chainName, marketAddress, tokenInAddress, tokenInAmount, slippageTolerance }: Props,
    options: FunctionOptions,
): Promise<FunctionReturn> {
    // Validation
    const chainId = getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Pendle is not supported on ${chainName}`, true);

    // Check wallet connection
    const account = await options.evm.getAddress();
    const {
        notify,
        evm: { getProvider, sendTransactions },
    } = options;

    // Get default value for slippage tolerance
    slippageTolerance = slippageTolerance ?? DEFAULT_SLIPPAGE_TOLERANCE;

    // Get all active markets
    const pendleClient = new PendleClient();
    let markets = await pendleClient.getActiveMarkets(chainId);

    // Check if any active market matches the market address
    const market = markets.find((m) => m.address === marketAddress);
    if (!market) {
        return toResult(`Could not find market ${marketAddress} on ${chainName}, or market is not active`);
    }

    // Convert amount from human readable to wei
    const provider = getProvider(chainId);
    const tokenInfo = await fetchTokenInfoFromAddress(provider, tokenInAddress);
    const tokenAmountInWei = parseUnits(tokenInAmount.toString(), tokenInfo.decimals);

    // Check that the user has enough token balance
    let tokenBalance: bigint;
    if (tokenInfo.address === PENDLE_NATIVE_TOKEN_ADDRESS) {
        tokenBalance = await provider.getBalance({
            address: account,
        });
    } else {
        tokenBalance = await provider.readContract({
            address: tokenInfo.address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account],
        });
    }
    if (tokenBalance < tokenAmountInWei) {
        return toResult(`Not enough ${tokenInfo.symbol} balance to add liquidity (${formatUnits(tokenBalance, tokenInfo.decimals)} ${tokenInfo.symbol}).`);
    }

    notify(`Preparing to add liquidity on Pendle market ${market.name}...`);

    // Prepare API call to get TX data from Pendle
    const convertParams = {
        chainId,
        tokensIn: tokenInfo.address, // do not use tokenInAddress here because for native tokens it is different
        amountsIn: tokenAmountInWei.toString(),
        tokensOut: market.address,
        receiver: account,
        slippage: slippageTolerance,
        enableAggregator: true,
    };

    // Perform the actual call and handle known errors
    let convertResponse: ConvertResponse;
    try {
        convertResponse = await pendleClient.convert(convertParams);
    } catch (error: unknown) {
        // Messages like "Asset with id 8453-0x0555e not found"
        // mean that the token is not supported by Pendle
        if (error instanceof PendleApiError && error.message.match(/Asset with id .* not found/)) {
            return toResult(`Token ${tokenInfo.symbol} is not supported by Pendle`);
        } else {
            throw error;
        }
    }

    // Check that there is at least a route for the swap
    const txData = convertResponse?.routes[0]?.tx;
    if (!txData) {
        return toResult(`Could not find a route for the liquidity add`);
    }

    // Build transactions
    const transactions: EVM.types.TransactionParams[] = [];

    // Approve tokens if needed
    if (convertResponse.requiredApprovals) {
        if (convertResponse.requiredApprovals.length > 0) {
            notify(`Will ask for ${convertResponse.requiredApprovals.length} token approval...`);
        }
        for (const approval of convertResponse.requiredApprovals) {
            await checkToApprove({
                args: {
                    account,
                    target: tokenInfo.address,
                    spender: txData.to,
                    amount: BigInt(approval.amount),
                },
                provider,
                transactions,
            });
        }
    }

    // Prepare liquidity add transaction
    const addLiquidityTx: EVM.types.TransactionParams = {
        target: txData.to,
        data: txData.data,
        value: BigInt(txData.value || '0'),
    };
    transactions.push(addLiquidityTx);

    // Send transactions
    if (transactions.length === 1) {
        await options.notify('Sending add liquidity transaction...');
    } else if (transactions.length > 1) {
        await options.notify('Sending approval & add liquidity transactions...');
    }
    const result = await sendTransactions({ chainId, account, transactions });
    const addLiquidityTxMessage = result.data[result.data.length - 1];

    return toResult(`Successfully added liquidity to market ${market.name} by zapping in ${tokenInAmount} ${tokenInfo.symbol}. ${addLiquidityTxMessage.message}`);
}
