import { FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { PendleClient } from '../helpers/client';
import { getChainIdFromChainName } from '../helpers/chains';
import { formatMarketData } from '../helpers/markets';

interface Props {
    chainName: string;
    marketAddress: string;
}

export async function getDataOnMarket({ chainName, marketAddress }: Props, { notify }: FunctionOptions): Promise<FunctionReturn> {
    // Get all active markets
    await notify(`Fetching market data for ${marketAddress} on ${chainName}...`);
    const pendleClient = new PendleClient();
    const chainId = getChainIdFromChainName(chainName);
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
    return toResult(formatMarketData(marketData, market));
}
