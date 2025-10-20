import { EVM, EvmChain, FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { supportedChains } from '../constants';
import { ConvexCurveClient } from '../client';
import { formatConvexLpToken, formatConvexLpTokenShort, getConvexLpTokenUiName, enrichConvexToken } from '../helpers/lps';

interface Props {
    chainName: string;
    convexLpIdOrName: string;
}

export async function findConvexLpInfo({ chainName, convexLpIdOrName }: Props, { evm: { getProvider, getAddress } }: FunctionOptions): Promise<FunctionReturn> {
    // Validation
    const chainId = EVM.utils.getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Unsupported chain: ${chainName}`, true);

    // Get provider and account
    const provider = getProvider(chainId);
    const account = await getAddress();

    // Fetch all Convex pools
    const client = new ConvexCurveClient();
    const pools = await client.pools(chainName);

    // First attempt to match by ID
    let pool = pools.find((pool) => pool.convexPoolData.id.toString() === convexLpIdOrName);

    // If not found, match by UI name
    // In case of multiple matches, show the user the options and ask them
    // to disambiguate
    if (!pool) {
        const matchingPools = pools.filter((pool) => getConvexLpTokenUiName(pool).toLowerCase() === convexLpIdOrName.toLowerCase());
        if (matchingPools.length > 1) {
            const apys = await client.apys(chainName);
            let parts: string[] = [];
            parts.push(`Found ${matchingPools.length} matches for the query "${convexLpIdOrName}":`);
            for (const pool of matchingPools) {
                const enrichedPool = await enrichConvexToken(pool, provider, apys[pool.id], account);
                parts.push(` - ${formatConvexLpTokenShort(enrichedPool)}`);
            }
            let message = parts.join('\n');
            return toResult(message); // not an error, let the LLM decide what to do
        }
        pool = matchingPools[0];
    }

    // Nothing found...
    if (!pool) {
        if (parseInt(convexLpIdOrName)) {
            return toResult(`No Convex LP token found with ID ${convexLpIdOrName} on ${chainName} chain.\n`);
        } else {
            let message = `No Convex LP token found with name '${convexLpIdOrName}' on ${chainName} chain.\n`;
            if (!convexLpIdOrName.includes('+')) {
                message +=
                    'IMPORTANT: Make sure you are using the correct name: the name of a Convex LP token consists of the symbols of the pool coins, separated by a plus sign: "ETH+stETH", "USDC+USDT", "crvUSD+tBTC+wstETH", etc.';
            }
            return toResult(message);
        }
    }

    // Enrich the pool with the APY and user balances
    const apys = await client.apys(chainName);
    const enrichedPool = await enrichConvexToken(pool, provider, apys[pool.id], account);

    return toResult(formatConvexLpToken(enrichedPool));
}
