import { FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { PendleClient } from '../helpers/client';
import { flattenAndSortPositions, formatFlattenedPositions } from '../helpers/positions';
import { MAX_POSITIONS_IN_RESULTS } from '../constants';
import { getChainNameFromChainId } from '../helpers/chains';
import { fetchTokenInfoFromAddress } from '../helpers/tokens';
import { to$$$ } from '../helpers/format';
import { erc20Abi, formatUnits } from 'viem';

interface Props {}

export async function getMyPositionsPortfolio(_props: Props, { notify, evm: { getAddress, getProvider } }: FunctionOptions): Promise<FunctionReturn> {
    // Get positions
    const account = await getAddress();
    await notify('Checking portfolio...');
    const pendleClient = new PendleClient();
    const positionsForAllChains = await pendleClient.getAddressPositions(account);
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
        `Found ${flattenedResult.totalPositions} positions in your portfolio, worth a total of ${to$$$(flattenedResult.totalValuation)}`,
        firstNPositions.length !== flattenedResult.totalPositions ? `Showing only the first ${MAX_POSITIONS_IN_RESULTS} ones:` : '',
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
                    if (syPosition.balance === '0') {
                        continue;
                    }
                    // Fetch decimals and symbol of the SY token
                    const provider = getProvider(chain.chainId);
                    const syTokenAddress = syPosition.syId.split('-')[1] as `0x${string}`;
                    const syTokenInfo = await fetchTokenInfoFromAddress(provider, syTokenAddress);
                    // Fetch the token balance on-chain as the SY token balance is not always accurate
                    const syTokenBalance = await provider.readContract({
                        address: syTokenInfo.address,
                        abi: erc20Abi,
                        functionName: 'balanceOf',
                        args: [account],
                    });
                    subparts.push(`${formatUnits(syTokenBalance, syTokenInfo.decimals)} ${syTokenInfo.symbol}`);
                }
                parts.push(` - ${chainName} chain: ${subparts.join(', ')}`);
            }
        }
    }

    return toResult(parts.filter(Boolean).join('\n'));
}
