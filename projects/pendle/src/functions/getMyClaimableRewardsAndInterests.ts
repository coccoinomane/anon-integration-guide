import { EVM, EvmChain, FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { PendleClient } from '../helpers/client';
import { flattenAndSortPositions } from '../helpers/positions';
import { supportedChains } from '../constants';
import { fetchTokenInfoFromAddress, TokenInfo } from '../helpers/tokens';
import { formatUnits } from 'viem';

interface Props {
    chainName: string;
}

const { getChainFromName } = EVM.utils;

export async function getMyClaimableRewardsAndInterests({ chainName }: Props, { notify, evm: { getAddress, getProvider } }: FunctionOptions): Promise<FunctionReturn> {
    // Validation
    const chainId = getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Pendle is not supported on ${chainName}`, true);

    // Get positions
    const account = await getAddress();
    await notify('Checking rewards and interests...');
    const pendleClient = new PendleClient();
    const positionsForAllChains = await pendleClient.getAddressPositions(account);
    if (!positionsForAllChains || positionsForAllChains.length === 0) {
        return toResult('No positions found in your portfolio');
    }

    // Flatten and sort all PT, YT, and LP positions by valuation
    // keeping also zero positions (they might have claimable yield)
    const flattenedResult = await flattenAndSortPositions(positionsForAllChains, true, true);

    // Keep only the positions with claimable yield on the given chain
    const positionsWithClaimableYield = flattenedResult.positions.filter((p) => p.chainId === chainId && p.claimTokenAmounts && p.claimTokenAmounts.some((c) => c.amount !== '0'));
    if (positionsWithClaimableYield.length === 0) {
        return toResult(`No positions with claimable yield found in your portfolio on chain ${chainName}`);
    }

    // Extract the list of tokens to be claimed
    const tokensToBeClaimed = positionsWithClaimableYield
        .map((p) => p.claimTokenAmounts.map((c) => c.token))
        .flat()
        .filter(Boolean);
    const uniqueTokensToBeClaimed = [...new Set(tokensToBeClaimed)];

    // Construct an address-tokenInfo map for the tokens to be claimed
    const provider = getProvider(chainId);
    const tokenInfoObject: Record<`0x${string}`, TokenInfo> = {};
    for (const token of uniqueTokensToBeClaimed) {
        tokenInfoObject[token] = await fetchTokenInfoFromAddress(provider, token);
    }

    // Get all Pendle assets from the API (memoized)
    const assets = await pendleClient.getAllAssets(chainId);

    // Build the output string
    const parts: string[] = [];
    parts.push(`Found ${positionsWithClaimableYield.length} positions with claimable rewards and/or interests:`);
    for (let i = 0; i < positionsWithClaimableYield.length; i++) {
        const position = positionsWithClaimableYield[i];
        const subparts = [];
        for (const claimTokenAmount of position.claimTokenAmounts) {
            const tokenInfo = tokenInfoObject[claimTokenAmount.token];
            // For SY tokens, use the token name from the APY response (which is the underlying token symbol).  For other tokens, use the symbol.
            const tokenLabel = tokenInfo.symbol.startsWith('SY') ? assets.find((a) => a.address === claimTokenAmount.token)?.name : tokenInfo.symbol;
            subparts.push(`${formatUnits(BigInt(claimTokenAmount.amount), tokenInfo.decimals)} ${tokenLabel}`);
        }
        parts.push(`${position.tokenType} position on ${position.marketName} market: can claim ${subparts.join(', ')}`);
    }

    return toResult(parts.join('\n'));
}
