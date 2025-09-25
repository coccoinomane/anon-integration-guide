import { EVM, EvmChain } from '@heyanon/sdk';
import { FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { PendleClient } from '../helpers/client';
import { supportedChains } from '../constants';

interface Props {
    chainName: string;
    searchString: string;
}

const { getChainFromName } = EVM.utils;

export async function searchMarketsByName({ chainName, searchString }: Props, _options: FunctionOptions): Promise<FunctionReturn> {
    // Validation
    const chainId = getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Pendle is not supported on ${chainName}`, true);

    // Get all active markets
    const pendleClient = new PendleClient();
    let markets = await pendleClient.getActiveMarkets(chainId);

    // Check if any active market matches the search string
    let matchingMarkets = markets.filter((m) => m.name.toLowerCase().includes(searchString.toLowerCase()));
    if (!matchingMarkets.length) {
        return toResult(`Could not find any active market with '${searchString}' in the name on ${chainName}`);
    }

    // Return matching market names & addresses
    return toResult(matchingMarkets.map((m) => `${m.name}: ${m.address}`).join('\n'));
}
