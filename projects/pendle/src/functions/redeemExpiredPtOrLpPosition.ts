import { erc20Abi } from 'viem';
import { FunctionOptions, FunctionReturn, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { ExitPositionsParams, ExitPositionsResponse, PendleApiError, PendleClient } from '../helpers/client';
import { fetchTokenInfoFromAddress, TokenInfo } from '../helpers/tokens';
import { DEFAULT_SLIPPAGE_TOLERANCE, supportedChains } from '../constants';
import { toHumanReadableAmount } from '../helpers/format';

interface Props {
    chainName: string;
    positionType: 'PT' | 'LP';
    marketAddress: `0x${string}`;
    tokenOutAddress: `0x${string}`;
    redeemPercentage: number | null;
    slippageTolerance: number | null;
}

const { getChainFromName, checkToApprove } = EVM.utils;

// Simple ABI for the isExpired view function
const isExpiredAbi = [
    {
        inputs: [],
        name: 'isExpired',
        outputs: [{ type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

export async function redeemExpiredPtOrLpPosition(
    { chainName, positionType, marketAddress, tokenOutAddress, redeemPercentage, slippageTolerance }: Props,
    options: FunctionOptions,
): Promise<FunctionReturn> {
    // Validation
    const chainId = getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Pendle is not supported on ${chainName}`, true);

    // Get default values
    slippageTolerance = slippageTolerance ?? DEFAULT_SLIPPAGE_TOLERANCE;
    if (slippageTolerance > 1 || slippageTolerance < 0) {
        return toResult(`Slippage tolerance must be between 0 and 1`);
    }
    redeemPercentage = redeemPercentage ?? 1;
    if (redeemPercentage > 1 || redeemPercentage < 0) {
        return toResult(`Redeem percentage must be between 0 and 1`);
    }

    // Check wallet connection
    const account = await options.evm.getAddress();
    const {
        notify,
        evm: { getProvider, sendTransactions },
    } = options;
    const provider = getProvider(chainId);

    // Get inactive markets and all assets (expired positions are likely to be in inactive markets)
    const pendleClient = new PendleClient();
    const [inactiveMarkets, assets] = await Promise.all([pendleClient.getInactiveMarkets(chainId), pendleClient.getAllAssets(chainId)]);

    // Check if any inactive market matches the market address
    let market = inactiveMarkets.find((m) => m.address === marketAddress);

    // If not found in inactive markets, check active markets
    if (!market) {
        const activeMarkets = await pendleClient.getActiveMarkets(chainId);
        market = activeMarkets.find((m) => m.address === marketAddress);
    }

    if (!market) {
        return toResult(`Could not find market ${marketAddress} on ${chainName}`);
    }

    // Check if the market is expired using the isExpired view function
    let isExpired: boolean;
    try {
        isExpired = await provider.readContract({
            address: marketAddress,
            abi: isExpiredAbi,
            functionName: 'isExpired',
        });
    } catch (error) {
        return toResult(`Could not check if market ${marketAddress} is expired. Please verify the market address.`, true);
    }

    if (!isExpired) {
        return toResult(`Market ${market.name} has not expired yet (expiry: ${market.expiry}). If you want to exit the position, you can swap out of it.`);
    }

    // Determine which token address to use based on position type
    let positionTokenAddress: `0x${string}`;
    let positionTokenDecimals: number;

    if (positionType === 'PT') {
        positionTokenAddress = market.pt.split('-')[1] as `0x${string}`;
        if (!positionTokenAddress) {
            return toResult(`Could not find PT token address for market ${market.name}`, true);
        }
        // Find the PT asset to get its decimals
        const ptAsset = assets.find((a) => a.address === positionTokenAddress);
        if (!ptAsset) {
            return toResult(`Could not find PT token info for market ${market.name}`, true);
        }
        positionTokenDecimals = ptAsset.decimals;
    } else if (positionType === 'LP') {
        // For LP positions, the market address itself is the LP token
        positionTokenAddress = marketAddress;
        // Find the LP asset to get its decimals
        const lpAsset = assets.find((a) => a.address === marketAddress);
        if (!lpAsset) {
            return toResult(`Could not find LP token info for market ${market.name}`, true);
        }
        positionTokenDecimals = lpAsset.decimals;
    } else {
        return toResult(`Invalid position type: ${positionType}. Must be either "PT" or "LP"`, true);
    }

    // Get the user's position balance
    const positionBalanceInWei = await provider.readContract({
        address: positionTokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account],
    });

    if (positionBalanceInWei === 0n) {
        return toResult(`No ${positionType} balance to redeem from ${market.name} on ${chainName}`);
    }

    // Determine the amount to redeem
    let positionBalanceToRedeemInWei = positionBalanceInWei;
    if (redeemPercentage === 1) {
        positionBalanceToRedeemInWei = positionBalanceInWei;
        notify(
            `Will redeem all of your ${positionType} position from ${market.name} market to ${tokenOutAddress}, for a total of ${toHumanReadableAmount(positionBalanceToRedeemInWei, positionTokenDecimals)} ${positionType} tokens`,
        );
    } else {
        const redeemPercentageAsBigIntPercentage = BigInt(redeemPercentage * 10000);
        positionBalanceToRedeemInWei = (positionBalanceInWei * redeemPercentageAsBigIntPercentage) / 10000n;
        notify(
            `Will redeem ${redeemPercentage * 100}% of your ${positionType} position from ${market.name} market to ${tokenOutAddress}, for a total of ${toHumanReadableAmount(positionBalanceToRedeemInWei, positionTokenDecimals)} ${positionType} tokens`,
        );
    }

    // Get info on the output token
    const outputTokenInfo: TokenInfo = await fetchTokenInfoFromAddress(provider, tokenOutAddress);

    notify(`Preparing to redeem expired ${positionType} position from Pendle market ${market.name} to ${outputTokenInfo.symbol}...`);

    // Prepare API call to get TX data from Pendle using exitPositions
    const exitParams: ExitPositionsParams = {
        chainId,
        market: marketAddress,
        receiver: account,
        slippage: slippageTolerance,
        tokenOut: outputTokenInfo.address,
        ptAmount: positionType === 'PT' ? positionBalanceToRedeemInWei.toString() : '0',
        ytAmount: '0',
        lpAmount: positionType === 'LP' ? positionBalanceToRedeemInWei.toString() : '0',
        enableAggregator: true,
    };

    // Perform the actual call and handle known errors
    let exitResponse: ExitPositionsResponse;
    try {
        exitResponse = await pendleClient.exitPositions(exitParams);
    } catch (error: unknown) {
        // Messages like "Asset with id 8453-0x0555e not found"
        // mean that the token is not supported by Pendle
        if (error instanceof PendleApiError && error.message.match(/Asset with id .* not found/)) {
            return toResult(`Token ${outputTokenInfo.symbol} is not supported by Pendle`);
        } else {
            throw error;
        }
    }

    // Check that the TX data is populated
    const txData = exitResponse?.tx;
    if (!txData) {
        return toResult(`Could not find a route for the position redemption`);
    }

    // Build transactions
    const transactions: EVM.types.TransactionParams[] = [];

    // Approve tokens if needed
    if (exitResponse.tokenApprovals) {
        if (exitResponse.tokenApprovals.length > 0) {
            notify(`Will ask for ${exitResponse.tokenApprovals.length} token approval${exitResponse.tokenApprovals.length > 1 ? 's' : ''}...`);
        }
        for (const approval of exitResponse.tokenApprovals) {
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

    // Prepare redeem transaction
    const redeemTx: EVM.types.TransactionParams = {
        target: txData.to,
        data: txData.data,
        value: BigInt(txData.value || '0'),
    };
    transactions.push(redeemTx);

    // Send transactions
    if (transactions.length === 1) {
        await options.notify('Sending redeem transaction...');
    } else if (transactions.length > 1) {
        await options.notify('Sending approval & redeem transactions...');
    }
    const result = await sendTransactions({ chainId, account, transactions });
    const redeemTxMessage = result.data[result.data.length - 1];

    // Extract amount out info if available
    const amountOut = exitResponse.data?.amountOut;
    let amountOutMessage = '';
    if (amountOut) {
        const amountOutFormatted = toHumanReadableAmount(BigInt(amountOut), outputTokenInfo.decimals);
        amountOutMessage = ` You received approximately ${amountOutFormatted} ${outputTokenInfo.symbol}.`;
    }

    return toResult(
        `Successfully redeemed expired ${positionType} position from market ${market.name} to ${outputTokenInfo.symbol}.${amountOutMessage} ${redeemTxMessage.message}`,
    );
}
