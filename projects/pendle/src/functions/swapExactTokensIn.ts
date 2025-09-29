import { erc20Abi, formatUnits, parseUnits, PublicClient } from 'viem';
import { FunctionOptions, FunctionReturn, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { ConvertParams, ConvertResponse, PendleApiError, PendleAsset, PendleAssetTag, PendleClient } from '../helpers/client';
import { fetchTokenInfoFromAddress } from '../helpers/tokens';
import { DEFAULT_SLIPPAGE_TOLERANCE, PENDLE_NATIVE_TOKEN_ADDRESS, supportedChains } from '../constants';
import { toHumanReadableAmount } from '../helpers/format';

interface Props {
    chainName: string;
    tokenInAddress: `0x${string}`;
    tokenInAmount: string;
    tokenOutAddress: `0x${string}`;
    slippageTolerance: number | null;
}

const { checkToApprove, getChainFromName } = EVM.utils;

export async function swapExactTokensIn(
    { chainName, tokenInAddress, tokenInAmount, tokenOutAddress, slippageTolerance }: Props,
    options: FunctionOptions,
): Promise<FunctionReturn> {
    // Validation
    const chainId = getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Pendle is not supported on ${chainName}`, true);
    if (tokenInAddress === tokenOutAddress) return toResult(`Input and output token addresses cannot be the same`, true);

    // Get default values
    slippageTolerance = slippageTolerance ?? DEFAULT_SLIPPAGE_TOLERANCE;
    if (slippageTolerance > 1 || slippageTolerance < 0) {
        return toResult(`Slippage tolerance must be between 0 and 1`);
    }

    // Check wallet connection
    const account = await options.evm.getAddress();
    const {
        notify,
        evm: { getProvider, sendTransactions },
    } = options;
    const provider = getProvider(chainId);

    // Get all Pendle assets
    const pendleClient = new PendleClient();
    let assets = await pendleClient.getAllAssets(chainId);

    // Get token information for tokenIn and tokenOut
    const tokenInType = assets.find((a) => a.address === tokenInAddress)?.tags[0] ?? 'NORMAL';
    const tokenInInfo = await getTokenInfo(provider, tokenInAddress, tokenInType, assets);
    const tokenOutType = assets.find((a) => a.address === tokenOutAddress)?.tags[0] ?? 'NORMAL';
    const tokenOutInfo = await getTokenInfo(provider, tokenOutAddress, tokenOutType, assets);

    // Pendle tokens should be shown by name rather than symbol, because this
    // is how they are shown in the Pendle UI (the name contains the underlying
    // token name, the symbol contains the maturation token name).  SY tokens
    // are an exception, because their name is the same as the underlying symbol,
    // therefore for SY tokens we use the symbol.
    let tokenInLabel = tokenInInfo.symbol;
    if (tokenInType !== 'NORMAL' && tokenInType !== 'SY') {
        tokenInLabel = tokenInInfo.name;
    }
    let tokenOutLabel = tokenOutInfo.symbol;
    if (tokenOutType !== 'NORMAL' && tokenOutType !== 'SY') {
        tokenOutLabel = tokenOutInfo.name;
    }

    // If both tokens are "normal" tokens, then it is not possible to swap
    if (tokenInType === 'NORMAL' && tokenOutType === 'NORMAL') {
        return toResult(
            `It seems you are trying to use Pendle to swap two non-Pendle tokens (${tokenInLabel} and ${tokenOutLabel}). This is not supported, please use a regular DEX or aggregator instead.`,
        );
    }

    // Conversion between PT and YT tokens is not supported
    // See https://discord.com/channels/771971117396393995/878735620850221126/1422178652736716811
    if ((tokenInType === 'PT' && tokenOutType === 'YT') || (tokenInType === 'YT' && tokenOutType === 'PT')) {
        return toResult(`Pendle does not support direct conversion between PT and YT tokens.  Please swap to another token first, or convert to the underlying token.`, true);
    }

    // Allow the user to zap from "normal" tokens (e.g. ETH or USDC) to
    // Pendle tokens (PT, YT, LP, SY).
    const enableAggregator = true;

    // Convert amount from human readable to wei
    const tokenInAmountInWei = parseUnits(tokenInAmount, tokenInInfo.decimals);

    // Check that the user has enough token balance
    let tokenInBalance: bigint;
    if (tokenInInfo.address === PENDLE_NATIVE_TOKEN_ADDRESS) {
        tokenInBalance = await provider.getBalance({
            address: account,
        });
    } else {
        tokenInBalance = await provider.readContract({
            address: tokenInInfo.address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account],
        });
    }
    if (tokenInBalance < tokenInAmountInWei) {
        return toResult(`Not enough ${tokenInLabel} balance to swap (${formatUnits(tokenInBalance, tokenInInfo.decimals)} ${tokenInLabel}).`);
    }

    // Notify the user of the swap
    notify(`Preparing to swap ${tokenInAmount} ${tokenInLabel} for ${tokenOutLabel}...`);

    // Prepare API call to get TX data from Pendle
    const convertParams: ConvertParams = {
        chainId,
        tokensIn: tokenInInfo.address, // do not use tokenInAddress here because for native tokens it is different
        amountsIn: tokenInAmountInWei.toString(),
        tokensOut: tokenOutInfo.address,
        receiver: account,
        slippage: slippageTolerance,
        enableAggregator,
    };

    // Perform the actual call and handle known errors
    let convertResponse: ConvertResponse;
    try {
        convertResponse = await pendleClient.convert(convertParams);
    } catch (error: unknown) {
        // Messages like "Asset with id 8453-0x0555e not found"
        // mean that the token is not supported by Pendle
        if (error instanceof PendleApiError) {
            if (error.message.match(/Asset with id .* not found/)) {
                return toResult(`Operation failed because token ${tokenInLabel} is not supported by Pendle`, true);
            } else if (error.message.match(/([Uu]nable to classify)|([Uu]nsupported method)/)) {
                return toResult(`Operation not permitted by Pendle: ${error.message}`, true);
            }
            throw error;
        } else {
            throw error;
        }
    }

    // Check that there is at least a route for the swap
    const txData = convertResponse?.routes[0]?.tx;
    if (!txData) {
        return toResult(`Could not find a route for the swap`);
    }

    // Extract the amount of tokens out
    const tokenOutAmountInWei = BigInt(convertResponse.routes[0].outputs[0].amount);
    notify(`Will receive approximately ${toHumanReadableAmount(tokenOutAmountInWei, tokenOutInfo.decimals)} ${tokenOutLabel}`);

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

    // Prepare swap transaction
    const swapTx: EVM.types.TransactionParams = {
        target: txData.to,
        data: txData.data,
        value: BigInt(txData.value || '0'),
    };
    transactions.push(swapTx);

    // Send transactions
    if (transactions.length === 1) {
        await options.notify('Sending swap transaction...');
    } else if (transactions.length > 1) {
        await options.notify('Sending approval & swap transactions...');
    }
    const result = await sendTransactions({ chainId, account, transactions });
    const swapTxMessage = result.data[result.data.length - 1];

    let message = `Successfully swapped ${tokenInAmount} ${tokenInLabel} for approximately ${toHumanReadableAmount(tokenOutAmountInWei, tokenOutInfo.decimals)} ${tokenOutLabel}. ${swapTxMessage.message}`;
    if (['PT', 'YT', 'PENDLE_LP'].includes(tokenOutInfo.type)) {
        message += `\nPlease note that you acquired a ${tokenOutInfo.type} token expiring on ${tokenOutInfo.expiry}.`;
    }

    return toResult(message);
}

type GenericTokenInfo = {
    type: PendleAssetTag | 'NORMAL';
    symbol: string;
    name: string;
    decimals: number;
    address: `0x${string}`;
    expiry?: string;
    tags?: PendleAssetTag[];
    proicon?: string;
};

/**
 * Get token information regardless of whether it is
 * a normal token or a Pendle token.  Info for "normal"
 * tokens will be fetched onchain, while info for Pendle
 * tokens will be fetched from the getAllAssets API
 * endpoint.
 */
async function getTokenInfo(provider: PublicClient, address: `0x${string}`, type: PendleAssetTag | 'NORMAL', assets: PendleAsset[]): Promise<GenericTokenInfo> {
    if (type === 'NORMAL') {
        const info = await fetchTokenInfoFromAddress(provider, address);
        return {
            type,
            ...info,
        };
    } else {
        const info = assets.find((a) => a.address === address);
        if (!info) {
            throw new Error(`${type} token with address ${address} not found`);
        }
        return {
            type,
            ...info,
        };
    }
}
