import { EVM, EvmChain, FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { supportedChains } from '../constants';
import { ConvexCurveClient, LendingVault, Pool } from '../client';
import { formatConvexToken, enrichConvexToken, getConvexTokenUiName, isPoolOrVaultInactive } from './poolAndVaults';

/**
 * Implementation of the getConvexLiquidityPool and
 * getConvexLendingVault tools. Since pools and vaults
 * are very similar, we need only one function to implement
 * both tools.
 */
export async function getConvexTokenToolHelper(
    chainName: string,
    convexTokenIdOrName: string,
    tokenType: 'LP' | 'LV',
    { evm: { getProvider, getAddress } }: FunctionOptions,
): Promise<FunctionReturn> {
    // Validation
    const chainId = EVM.utils.getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Unsupported chain: ${chainName}`, true);
    tokenType = tokenType.toUpperCase() as 'LP' | 'LV';
    if (tokenType !== 'LP' && tokenType !== 'LV') {
        return toResult(`Could not identify Convex token type "${tokenType}"`);
    }

    // Get provider and account
    const provider = getProvider(chainId);
    const account = await getAddress();

    // Fetch all Convex vaults
    const client = new ConvexCurveClient();
    const tokens = tokenType === 'LP' ? await client.pools(chainName) : await client.lendingVaults(chainName);
    const tokenLabel = tokenType === 'LP' ? 'Liquidity Pool' : 'Lending Vault';

    // First attempt to match by ID
    let token = tokens.find((token) => token.convexPoolData.id.toString() === convexTokenIdOrName.trim());

    // If not found, match by name, excluding inactive vaults
    if (!token) {
        const matchingTokens = tokenType === 'LP' ? matchPoolByName(tokens as Pool[], convexTokenIdOrName) : matchVaultByName(tokens as LendingVault[], convexTokenIdOrName);
        // In case of multiple matches, show the user the options
        // and ask them to disambiguate
        if (matchingTokens.length > 1) {
            const apys = await client.apys(chainName);
            let parts: string[] = [];
            parts.push(`Found ${matchingTokens.length} matches for the query "${convexTokenIdOrName}":`);
            for (const token of matchingTokens) {
                const enrichedToken = await enrichConvexToken(token, provider, apys[token.id], account);
                parts.push(`${enrichedToken.typeLabelShort.toUpperCase()} "${getConvexTokenUiName(token)}":`);
                parts.push(formatConvexToken(enrichedToken, false));
            }
            let message = parts.join('\n');
            return toResult(message); // not an error, let the LLM decide what to do
        }
        token = matchingTokens[0];
    }

    // Nothing found...
    if (!token) {
        if (/^\d+$/.test(convexTokenIdOrName)) {
            // Case of ID passed...
            return toResult(`No Convex ${tokenLabel} token found with ID ${convexTokenIdOrName} on ${chainName} chain.\n`);
        } else {
            // Case of name passed...
            let message: string;
            if (tokenType === 'LP') {
                message = `No active Convex ${tokenLabel} token found with name '${convexTokenIdOrName}' on ${chainName} chain.\n`;
                // For LP tokens, warn the user if the name is not a valid LP token name
                if (!convexTokenIdOrName.includes('+')) {
                    message +=
                        'IMPORTANT: Make sure you are using the correct name: the name of a Convex LP token consists of the symbols of the pool coins, separated by a plus sign: "ETH+stETH", "USDC+USDT", "crvUSD+tBTC+wstETH", etc.';
                }
            } else {
                message = `No active Convex ${tokenLabel} token found with collateral name '${convexTokenIdOrName}' on ${chainName} chain.\n`;
            }
            return toResult(message);
        }
    }

    // Enrich the token with the APY and user balances and return the result
    const apys = await client.apys(chainName);
    const enrichedToken = await enrichConvexToken(token, provider, apys[token.id], account);

    return toResult(formatConvexToken(enrichedToken));
}

/**
 * Generate all permutations of an array
 */
function getAllPermutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
        const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
        const restPermutations = getAllPermutations(rest);
        for (const perm of restPermutations) {
            result.push([arr[i], ...perm]);
        }
    }
    return result;
}

/**
 * Match a liquidity pool by name, normalizing separators
 * and checking all permutations of token symbols.
 * E.g., "ETH+stETH" will also match "stETH+ETH"
 */
function matchPoolByName(pools: Pool[], searchName: string): Pool[] {
    const trimmedInput = searchName.trim().toLowerCase();

    // First attempt: exact match without separator normalization
    const exactMatches = pools.filter((pool) => {
        const poolName = getConvexTokenUiName(pool).toLowerCase();
        return poolName === trimmedInput && !isPoolOrVaultInactive(pool);
    });

    // If we found exact matches, return them
    if (exactMatches.length > 0) {
        return exactMatches;
    }

    // Second attempt: normalize separators (convert "-" to "+") and try permutations
    const normalizedInput = trimmedInput.replace(/-/g, '+');

    // Generate all permutations if it contains a separator
    let searchNames: string[];
    if (normalizedInput.includes('+')) {
        const tokens = normalizedInput.split('+');
        const allPermutations = getAllPermutations(tokens);
        // Convert permutations back to strings and deduplicate
        const permutationStrings = allPermutations.map((perm) => perm.join('+'));
        searchNames = Array.from(new Set(permutationStrings));
    } else {
        searchNames = [normalizedInput];
    }

    // Filter pools by name, excluding inactive ones
    return pools.filter((pool) => {
        const poolName = getConvexTokenUiName(pool).toLowerCase();
        return searchNames.includes(poolName) && !isPoolOrVaultInactive(pool);
    });
}

/**
 * Match a lending vault by collateral symbol name.
 */
function matchVaultByName(vaults: LendingVault[], searchName: string): LendingVault[] {
    const normalizedInput = searchName.trim().toLowerCase();

    // Filter vaults by collateral symbol, excluding inactive ones
    return vaults.filter((vault) => {
        const vaultName = vault.assets.collateral.symbol.toLowerCase();
        return vaultName === normalizedInput && !isPoolOrVaultInactive(vault);
    });
}
