import { erc20Abi } from 'viem';
import { FunctionOptions, FunctionReturn, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { ConvertParams, ConvertResponse, PendleApiError, PendleClient } from '../helpers/client';
import { fetchTokenInfoFromAddress, TokenInfo } from '../helpers/tokens';
import { DEFAULT_SLIPPAGE_TOLERANCE, PENDLE_LP_TOKEN_DECIMALS, supportedChains } from '../constants';
import { toHumanReadableAmount } from '../helpers/format';

interface Props {
    chainName: string;
    marketAddress: `0x${string}`;
    tokenOutAddress: `0x${string}` | null;
    removalPercentage: number | null;
    slippageTolerance: number | null;
    redeemRewards: boolean | null;
}

const { getChainFromName, checkToApprove } = EVM.utils;

export async function removeLiquidityFromMarketPool(
    { chainName, marketAddress, tokenOutAddress, removalPercentage, slippageTolerance, redeemRewards }: Props,
    options: FunctionOptions,
): Promise<FunctionReturn> {
    // Validation
    const chainId = getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Pendle is not supported on ${chainName}`, true);

    // Get default values
    redeemRewards = redeemRewards ?? true;
    slippageTolerance = slippageTolerance ?? DEFAULT_SLIPPAGE_TOLERANCE;
    if (slippageTolerance > 1 || slippageTolerance < 0) {
        return toResult(`Slippage tolerance must be between 0 and 1`);
    }
    removalPercentage = removalPercentage ?? 1;
    if (removalPercentage > 1 || removalPercentage < 0) {
        return toResult(`Removal percentage must be between 0 and 1`);
    }

    // Check wallet connection
    const account = await options.evm.getAddress();
    const {
        notify,
        evm: { getProvider, sendTransactions },
    } = options;
    const provider = getProvider(chainId);

    // Get all active markets
    const pendleClient = new PendleClient();
    let markets = await pendleClient.getActiveMarkets(chainId);

    // Check if any active market matches the market address
    const market = markets.find((m) => m.address === marketAddress);
    if (!market) {
        return toResult(`Could not find market ${marketAddress} on ${chainName}, or market is not active`);
    }

    // Get the user liquidity
    const lpBalanceInWei = await provider.readContract({
        address: marketAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account],
    });

    // Get address of the underlying asset of the market
    const underlyingAssetAddress = market?.underlyingAsset?.split('-')[1] as `0x${string}`;
    if (!underlyingAssetAddress) {
        return toResult(`Could not find underlying asset for market, please explicitly specify output token`);
    }

    // Get info on the output token (and if native token it will also
    // convert its address to Pendle native token address)
    let outputTokenInfo: TokenInfo;
    let enableAggregator: boolean;
    if (tokenOutAddress) {
        outputTokenInfo = await fetchTokenInfoFromAddress(provider, tokenOutAddress);
        enableAggregator = true;
    } else {
        // If no output token address is provided, use the underlying asset of the market
        outputTokenInfo = await fetchTokenInfoFromAddress(provider, underlyingAssetAddress);
        enableAggregator = false;
    }

    // If the output token is the same as the underlying asset, we don't need to zap out
    if (outputTokenInfo.address.toLowerCase() === underlyingAssetAddress.toLowerCase()) {
        enableAggregator = false;
    }

    // Determine the amount of liquidity to remove
    if (lpBalanceInWei === 0n) {
        return toResult(`No liquidity to remove from ${marketAddress} on ${chainName}`);
    }
    let lpBalanceToRemoveInWei = lpBalanceInWei;
    if (removalPercentage === 1) {
        lpBalanceToRemoveInWei = lpBalanceInWei;
        notify(
            `Will remove all of your liquidity from ${market.name} market to ${outputTokenInfo.symbol}, for a total of ${toHumanReadableAmount(lpBalanceToRemoveInWei, PENDLE_LP_TOKEN_DECIMALS)} LP tokens`,
        );
    } else {
        const removalPercentageAsBigIntPercentage = BigInt(removalPercentage * 10000);
        lpBalanceToRemoveInWei = (lpBalanceInWei * removalPercentageAsBigIntPercentage) / 10000n;
        notify(
            `Will remove ${removalPercentage * 100}% of your liquidity from ${market.name} market to ${outputTokenInfo.symbol}, for a total of ${toHumanReadableAmount(lpBalanceToRemoveInWei, PENDLE_LP_TOKEN_DECIMALS)} LP tokens`,
        );
    }

    notify(`Preparing to remove liquidity from Pendle market ${market.name}${enableAggregator ? ` (zap out to ${outputTokenInfo.symbol})` : ''}...`);

    // Prepare API call to get TX data from Pendle
    const convertParams: ConvertParams = {
        chainId,
        tokensIn: marketAddress,
        amountsIn: lpBalanceToRemoveInWei.toString(),
        tokensOut: outputTokenInfo.address,
        receiver: account,
        slippage: slippageTolerance,
        enableAggregator,
        redeemRewards,
    };

    // Perform the actual call and handle known errors
    let convertResponse: ConvertResponse;
    try {
        convertResponse = await pendleClient.convert(convertParams);
    } catch (error: unknown) {
        // Messages like "Asset with id 8453-0x0555e not found"
        // mean that the token is not supported by Pendle
        if (error instanceof PendleApiError && error.message.match(/Asset with id .* not found/)) {
            return toResult(`Token ${outputTokenInfo.symbol} is not supported by Pendle`);
        } else {
            throw error;
        }
    }

    // Check that there is at least a route for the swap
    const txData = convertResponse?.routes[0]?.tx;
    if (!txData) {
        return toResult(`Could not find a route for the liquidity remove`);
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
                    target: approval.token,
                    spender: txData.to,
                    amount: BigInt(approval.amount),
                },
                provider,
                transactions,
            });
        }
    }

    // Prepare liquidity add transaction
    const removeLiquidityTx: EVM.types.TransactionParams = {
        target: txData.to,
        data: txData.data,
        value: BigInt(txData.value || '0'),
    };
    transactions.push(removeLiquidityTx);

    // Send transactions
    if (transactions.length === 1) {
        await options.notify('Sending remove liquidity transaction...');
    } else if (transactions.length > 1) {
        await options.notify('Sending approval & remove liquidity transactions...');
    }
    const result = await sendTransactions({ chainId, account, transactions });
    const removeLiquidityTxMessage = result.data[result.data.length - 1];

    return toResult(`Successfully removed liquidity from market ${market.name} to ${outputTokenInfo.symbol}. ${removeLiquidityTxMessage.message}`);
}
