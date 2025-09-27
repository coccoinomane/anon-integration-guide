import { FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { PendleClient } from '../helpers/client';
import { flattenAndSortPositions, formatFlattenedPositions } from '../helpers/positions';
import { MAX_POSITIONS_IN_RESULTS } from '../constants';
import { getChainNameFromChainId } from '../helpers/chains';
import { fetchTokenInfoFromAddress } from '../helpers/tokens';
import { toHumanReadableAmount } from '../helpers/format';

interface Props {}

export async function getMyPositionsPortfolio(_props: Props, { notify, evm: { getAddress, getProvider } }: FunctionOptions): Promise<FunctionReturn> {
    // Get positions
    await notify('Checking portfolio...');
    const pendleClient = new PendleClient();
    const positionsForAllChains = await pendleClient.getAddressPositions(await getAddress());
    if (!positionsForAllChains || positionsForAllChains.length === 0) {
        return toResult('No positions found in your portfolio');
    }

    // Flatten and sort all PT, YT, and LP positions by valuation
    const flattenedResult = await flattenAndSortPositions(positionsForAllChains, false, true);

    // Format the flattened positions for display
    const firstNPositions = flattenedResult.positions.slice(0, MAX_POSITIONS_IN_RESULTS);
    const formattedOutput = formatFlattenedPositions(firstNPositions, ' - ');

    // Build and return output string
    const parts = [
        `Found ${flattenedResult.totalPositions} positions in your portfolio, worth a total of $${flattenedResult.totalValuation.toFixed(2)}`,
        firstNPositions.length !== flattenedResult.totalPositions ? `Showing the top ${MAX_POSITIONS_IN_RESULTS} positions by value:` : '',
        formattedOutput,
    ];

    // Count SY positions
    const syPositionsCount = positionsForAllChains.reduce((acc, chain) => acc + chain.syPositions.length, 0);

    if (syPositionsCount > 0) {
        parts.push(` `);
        parts.push(`In addition to the above positions, you also hold the following SY tokens:`);
        for (const chain of positionsForAllChains) {
            if (chain.syPositions.length > 0) {
                const chainName = getChainNameFromChainId(chain.chainId);
                const subparts = [];
                for (const syPosition of chain.syPositions) {
                    const tokenAddress = syPosition.syId.split('-')[1] as `0x${string}`;
                    const provider = getProvider(chain.chainId);
                    const tokenInfo = await fetchTokenInfoFromAddress(provider, tokenAddress);
                    const humanReadableBalance = toHumanReadableAmount(BigInt(syPosition.balance), tokenInfo.decimals);
                    subparts.push(`${humanReadableBalance} ${tokenInfo.symbol}`);
                }
                parts.push(` - ${chainName} chain: ${subparts.join(', ')}`);
            }
        }
    }

    return toResult(parts.filter(Boolean).join('\n'));
}
