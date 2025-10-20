import { EVM, EvmChain, FunctionOptions, FunctionReturn, toResult } from '@heyanon/sdk';
import { supportedChains } from '../constants';
import { ConvexCurveClient } from '../client';
import { formatConvexLvTokenShort } from '../helpers/vaults';
import { enrichConvexToken, formatConvexLpToken } from '../helpers/lps';

interface Props {
    chainName: string;
    convexLvIdOrName: string;
}

export async function findConvexLvInfo({ chainName, convexLvIdOrName }: Props, { evm: { getProvider, getAddress } }: FunctionOptions): Promise<FunctionReturn> {
    // Validation
    const chainId = EVM.utils.getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Unsupported chain: ${chainName}`, true);

    // Get provider and account
    const provider = getProvider(chainId);
    const account = await getAddress();

    // Fetch all Convex vaults
    const client = new ConvexCurveClient();
    const vaults = await client.lendingVaults(chainName);

    // First attempt to match by ID
    let vault = vaults.find((vault) => vault.convexPoolData.id.toString() === convexLvIdOrName);

    // If not found, match by collateral name
    // In case of multiple matches, show the user the options and ask them
    // to disambiguate
    if (!vault) {
        const matchingVaults = vaults.filter((vault) => vault.assets.collateral.symbol.toLowerCase() === convexLvIdOrName.toLowerCase());
        if (matchingVaults.length > 1) {
            let parts: string[] = [];
            parts.push(`Found ${matchingVaults.length} matches for the query "${convexLvIdOrName}":`);
            for (const vault of matchingVaults) {
                const enrichedVault = await enrichConvexToken(vault, provider, undefined, account);
                parts.push(` - ${formatConvexLvTokenShort(enrichedVault)}`);
            }
            let message = parts.join('\n');
            return toResult(message); // not an error, let the LLM decide what to do
        }
        vault = matchingVaults[0];
    }

    // Nothing found...
    if (!vault) {
        if (parseInt(convexLvIdOrName)) {
            return toResult(`No Convex LV token found with ID ${convexLvIdOrName} on ${chainName} chain.\n`);
        } else {
            let message = `No Convex LV token found with collateral name '${convexLvIdOrName}' on ${chainName} chain.\n`;
            return toResult(message);
        }
    }

    // Enrich the vault with the APY and user balances
    const apys = await client.apys(chainName);
    const enrichedVault = await enrichConvexToken(vault, provider, apys[vault.id], account);

    return toResult(formatConvexLpToken(enrichedVault));
}
