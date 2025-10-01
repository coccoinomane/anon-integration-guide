import { FunctionOptions, FunctionReturn, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { PendleClient, RedeemInterestsAndRewardsParams, RedeemInterestsAndRewardsResponse } from '../helpers/client';
import { supportedChains } from '../constants';

interface Props {
    chainName: string;
    positionsAddresses: `0x${string}`[];
}

const { getChainFromName, checkToApprove } = EVM.utils;

/**
 * TODO: Might be interesting to use this function to redeem matured
 * PT positions when a PT address is provided...
 */
export async function claimRewardsAndInterests({ chainName, positionsAddresses }: Props, options: FunctionOptions): Promise<FunctionReturn> {
    // Validation
    const chainId = getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Pendle is not supported on ${chainName}`, true);

    // Get default values
    positionsAddresses = positionsAddresses ?? [];

    // Validate & sanitize positions addresses
    if (positionsAddresses.length === 0) {
        return toResult(`No positions addresses provided`);
    }
    positionsAddresses = [...new Set(positionsAddresses)];

    // Check wallet connection
    const account = await options.evm.getAddress();
    const {
        notify,
        evm: { getProvider, sendTransactions },
    } = options;
    const provider = getProvider(chainId);

    // Check that the positions addresses are indeed Pendle tokens
    const pendleClient = new PendleClient();
    const assets = await pendleClient.getAllAssets(chainId);
    const positionsAssets = [];
    for (const positionAddress of positionsAddresses) {
        if (!assets.some((a) => a.address === positionAddress)) {
            return toResult(`Position address ${positionAddress} is not a Pendle token`);
        }
        const positionAsset = assets.find((a) => a.address === positionAddress);
        if (!positionAsset?.tags.includes('YT') && !positionAsset?.tags.includes('PENDLE_LP') && !positionAsset?.tags.includes('SY')) {
            return toResult(`Position address ${positionAddress} is not a yield accruing Pendle token`);
        }
        positionsAssets.push(positionAsset);
    }

    notify(`Preparing to claim rewards and interests for the following position${positionsAssets.length > 1 ? 's' : ''}: ${positionsAssets.map((a) => a.name).join(', ')}...`);

    // Prepare API call to get TX data from Pendle
    const redeemParams: RedeemInterestsAndRewardsParams = {
        chainId,
        receiver: account,
    };
    const sys = positionsAssets.filter((a) => a.tags.includes('SY')).map((a) => a.address);
    if (sys.length > 0) {
        redeemParams.sys = sys;
    }
    const yts = positionsAssets.filter((a) => a.tags.includes('YT')).map((a) => a.address);
    if (yts.length > 0) {
        redeemParams.yts = yts;
    }
    const markets = positionsAssets.filter((a) => a.tags.includes('PENDLE_LP')).map((a) => a.address);
    if (markets.length > 0) {
        redeemParams.markets = markets;
    }

    console.log('redeemParams', redeemParams);

    // Perform the actual call and handle known errors
    let redeemResponse: RedeemInterestsAndRewardsResponse;
    try {
        redeemResponse = await pendleClient.redeemInterestsAndRewards(redeemParams);
    } catch (error: unknown) {
        return toResult(`Error claiming rewards and interests for the following positions: ${positionsAssets.map((a) => a.name).join(', ')}`, true);
    }

    // Check that the TX data is populated
    const txData = redeemResponse?.tx;
    if (!txData || typeof txData.data !== 'string' || !txData.data.startsWith('0x')) {
        return toResult(`Pendle API returned no or invalid TX data`, true);
    }

    // Build transactions
    const transactions: EVM.types.TransactionParams[] = [];

    // Approve tokens if needed
    if (redeemResponse.tokenApprovals) {
        if (redeemResponse.tokenApprovals.length > 0) {
            notify(`Will ask for ${redeemResponse.tokenApprovals.length} token approval...`);
        }
        for (const approval of redeemResponse.tokenApprovals) {
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

    // Prepare the redeem transaction
    const redeemTx: EVM.types.TransactionParams = {
        target: txData.to,
        data: txData.data,
    };
    transactions.push(redeemTx);

    // Send transactions
    if (transactions.length === 1) {
        await options.notify('Sending claim transaction...');
    } else if (transactions.length > 1) {
        await options.notify('Sending approval & claim transactions...');
    }

    const result = await sendTransactions({ chainId, account, transactions });
    const redeemTxMessage = result.data[result.data.length - 1];

    return toResult(
        `Successfully claimed rewards and interests for the following position${positionsAssets.length > 1 ? 's' : ''}: ${positionsAssets.map((a) => a.name).join(', ')}. ${redeemTxMessage.message}`,
    );
}
