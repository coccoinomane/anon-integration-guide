import { EVM, EvmChain, FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { supportedChains } from '../constants';
import { ConvexCurveClient, LendingVault } from '../client';
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
    let token = tokens.find((token) => token.convexPoolData.id.toString() === convexTokenIdOrName);

    // If not found, match by name, excluding inactive vaults
    if (!token) {
        const matchingTokens = tokens.filter((token) => {
            // For details on token names, see tools.ts
            const tokenName = tokenType === 'LP' ? getConvexTokenUiName(token).toLowerCase() : (token as LendingVault).assets.collateral.symbol.toLowerCase();
            return tokenName === convexTokenIdOrName.toLowerCase() && !isPoolOrVaultInactive(token);
        });
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
        if (parseInt(convexTokenIdOrName)) {
            // Case of ID passed...
            return toResult(`No Convex ${tokenLabel} token found with ID ${convexTokenIdOrName} on ${chainName} chain.\n`);
        } else {
            // Case of name passed...
            let message = `No active Convex ${tokenLabel} token found with collateral name '${convexTokenIdOrName}' on ${chainName} chain.\n`;
            // For LP tokens, warn the user if the name is not a valid LP token name
            if (tokenType === 'LP' && !convexTokenIdOrName.includes('+')) {
                message +=
                    'IMPORTANT: Make sure you are using the correct name: the name of a Convex LP token consists of the symbols of the pool coins, separated by a plus sign: "ETH+stETH", "USDC+USDT", "crvUSD+tBTC+wstETH", etc.';
            }
            return toResult(message);
        }
    }

    // Enrich the token with the APY and user balances and return the result
    const apys = await client.apys(chainName);
    const enrichedToken = await enrichConvexToken(token, provider, apys[token.id], account);

    return toResult(formatConvexToken(enrichedToken));
}
