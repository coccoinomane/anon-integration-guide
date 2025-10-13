import { formatUnits } from 'viem';
import { EVM, EvmChain, FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { CONVEX_LP_TOKEN_DECIMALS, supportedChains } from '../constants';
import { ConvexCurveClient } from '../client';
import { formatLpToken, formatLpTokenShort, getLpTokenBalances, getLpUiName } from '../helpers/lps';

interface Props {
    chainName: string;
    lpIdOrName: string;
}

export async function findLpInfo({ chainName, lpIdOrName }: Props, { evm: { getProvider, getAddress } }: FunctionOptions): Promise<FunctionReturn> {
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
    let pool = pools.find((pool) => pool.convexPoolData.id.toString() === lpIdOrName);

    // If not found, match by UI name
    // In case of multiple matches, show the user the options and ask them
    // to disambiguate
    if (!pool) {
        const matchingPools = pools.filter((pool) => getLpUiName(pool).toLowerCase() === lpIdOrName.toLowerCase());
        if (matchingPools.length > 1) {
            let parts: string[] = [];
            parts.push(`Found ${matchingPools.length} matches for the name "${lpIdOrName}":`);
            for (const pool of matchingPools) {
                const lpBalances = await getLpTokenBalances(provider, pool.convexPoolData.id, account);
                const balanceString = `${formatUnits(lpBalances.total, CONVEX_LP_TOKEN_DECIMALS)} LP tokens`;
                parts.push(` - ${formatLpTokenShort(pool, balanceString)}`);
            }
            let message = parts.join('\n');
            return toResult(message); // not an error, let the LLM decide what to do
        }
        pool = matchingPools[0];
    }

    // Nothing found...
    if (!pool) {
        return toResult(`No Convex LP token found for ID or name: ${lpIdOrName}`); // not an error, let the LLM decide what to do
    }

    // Check whether the user has balance in the LP token
    const lpBalances = await getLpTokenBalances(provider, pool.convexPoolData.id, account);
    const balanceString = `${formatUnits(lpBalances.total, CONVEX_LP_TOKEN_DECIMALS)} LP tokens`;

    return toResult(formatLpToken(pool, balanceString));
}
