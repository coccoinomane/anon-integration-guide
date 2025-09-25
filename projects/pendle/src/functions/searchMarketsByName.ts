import { FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { PendleClient } from '../helpers/client';
import { getChainIdFromChainName } from '../helpers/chains';

interface Props {
    chainName: string;
    searchString: string;
}

export async function searchMarketsByName({ chainName, searchString }: Props, _options: FunctionOptions): Promise<FunctionReturn> {
    const pendleClient = new PendleClient();
    const chainId = getChainIdFromChainName(chainName);
    let markets = await pendleClient.getActiveMarkets(chainId);
    let market = markets.filter((m) => m.name.toLowerCase().includes(searchString.toLowerCase()));
    if (!market) {
        return toResult(`Could not find any active market with '${searchString}' in the name on ${chainName}`);
    }
    return toResult(market.map((m) => `${m.name}: ${m.address}`).join('\n'));
}
