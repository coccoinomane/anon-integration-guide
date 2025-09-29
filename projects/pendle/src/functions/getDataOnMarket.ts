import { FunctionOptions, FunctionReturn, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { PendleClient } from '../helpers/client';
import { formatMarketData } from '../helpers/markets';
import { supportedChains } from '../constants';

interface Props {
    chainName: string;
    marketAddress: string;
}

const { getChainFromName } = EVM.utils;

export async function getDataOnMarket({ chainName, marketAddress }: Props, { notify }: FunctionOptions): Promise<FunctionReturn> {
    // Validation
    const chainId = getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Pendle is not supported on ${chainName}`, true);

    // Get all active markets
    await notify(`Fetching market data for ${marketAddress} on ${chainName}...`);
    const pendleClient = new PendleClient();
    let markets = await pendleClient.getActiveMarkets(chainId);

    // Check if given market address exists
    let market = markets.find((m) => m.address === marketAddress);
    if (!market) {
        return toResult(`Could not find market ${marketAddress} on ${chainName}, or market is not active`);
    }

    // Fetch advanced market data
    let marketData = await pendleClient.getMarketData(chainId, marketAddress);
    if (!marketData) {
        return toResult(`Market data ${marketAddress} not found on ${chainName}`);
    }

    // Format and return result
    // NOTA BENE: It is important to include the tokens addresses in the result,
    // in case the getPendleTokenAddressFromTypeAndName is not enough to resolve
    // a Pendle token requested by the user.
    return toResult(formatMarketData(marketData, market, true));
}
