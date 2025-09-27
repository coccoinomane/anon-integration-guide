import { FunctionOptions, FunctionReturn, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { PendleClient } from '../helpers/client';
import { supportedChains } from '../constants';
import { filterActiveAssets } from '../helpers/tokens';
import { toTitleCase } from '../helpers/format';

interface Props {
    chainName: string;
    /** name of the token e.g. PT wstETH and YT wstETH */
    pendleTokenName: `${'PT' | 'YT' | 'SY'} ${string}`;
    /** short expiry e.g. 26MAR2026  */
    shortExpiry: string | null;
}

const { getChainFromName } = EVM.utils;

export async function getPendleTokensAddressFromName({ chainName, pendleTokenName, shortExpiry }: Props, _options: FunctionOptions): Promise<FunctionReturn> {
    // Validation
    const chainId = getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${toTitleCase(chainName)}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Pendle is not supported on ${toTitleCase(chainName)}`, true);

    // Make sure the token name is in the correct format
    if (!pendleTokenName.startsWith('PT ') && !pendleTokenName.startsWith('YT ') && !pendleTokenName.startsWith('SY ')) {
        return toResult(`Invalid name for a Pendle token, must start with "PT ", "YT " or "SY ": ${pendleTokenName}`, true);
    }

    // Get all Pendle assets from the API.
    //
    // Please note that with respect to the tool definition, Pendle token names
    // in the API (and in the smart contracts) include both the market token
    // (e.g. wstETH) and, in parentheses, the maturation token (e.g. stETH),
    // that is, the token to which the PT token will convert to at expiration.
    // For example, the name of the principal token for the wstETH market is
    // "PT wstETH (stETH)".
    //
    // Also worth noting is that Pendle token symbols contain only the symbol
    // of the maturation token (rather than the market token) and also include
    // the expiry date. For example, the symbol of the principal token for the
    // wstETH market is "PT-stETH-25DEC2025".
    const pendleClient = new PendleClient();
    let assets = await pendleClient.getAllAssets(chainId);

    // If no expiry date is specified, consider only active markets
    if (!shortExpiry) {
        assets = filterActiveAssets(assets);
    }

    // We first do a partial filter by NAME. It is important to use
    // the name instead of the symbol to reflect Pendle UI, where
    // the name (e.g. PT wstETH (stETH)) is shown rather than the
    // symbol (e.g. PT-stETH). Screenshot > https://d.pr/i/kM2EFC
    const byName = assets.filter((a) => a.name.toLowerCase().includes(pendleTokenName.toLowerCase()));

    // If no results were found, we tell the user without an error
    if (byName.length === 0) {
        return toResult(`Could not find any Pendle asset with '${pendleTokenName}' in the name on ${toTitleCase(chainName)}`);
    }

    // Case where no expiry date was specified
    if (!shortExpiry) {
        // If there is only one result, we return that result
        if (byName.length === 1) {
            return toResult(`${byName[0].name} on ${toTitleCase(chainName)} chain: ${byName[0].address}, expiry: ${byName[0].expiry}`);
        } else {
            // If there is more than one result, we return all of them
            // warning the user that there are multiple results
            return toResult(
                [
                    `Found multiple matching Pendle assets for ${pendleTokenName}:`,
                    byName.map((a) => ` - ${a.name} on ${toTitleCase(chainName)} chain: ${a.address}, expiry: ${a.expiry}`).join('\n'),
                ].join('\n'),
            );
        }
    }

    // Further filter by expiry date.  We use the symbol
    // to filter as it contains the expiry date in short format
    // e.g. PT-stETH-30MAR2026
    const byNameAndExpiry = byName.filter((a) => a.symbol.toLowerCase().includes(shortExpiry.toLowerCase()));

    // If there is a single match, return it
    if (byNameAndExpiry.length === 1) {
        return toResult(`${byNameAndExpiry[0].name} on ${toTitleCase(chainName)} chain: ${byNameAndExpiry[0].address}, expiry: ${byNameAndExpiry[0].expiry}`);
    } else if (byNameAndExpiry.length === 0) {
        // If nothing matches, we tell the user and/or show them
        // solutions with different expiry dates
        if (byName.length === 0) {
            return toResult(`Could not find any Pendle asset with '${pendleTokenName}' in the name on ${toTitleCase(chainName)} chain`);
        }
        if (byName.length > 0) {
            return toResult(
                [
                    `Found assets matching ${pendleTokenName} on ${toTitleCase(chainName)} chain but none of them has the requested expiry:`,
                    byName.map((a) => ` - ${a.name} on ${toTitleCase(chainName)} chain: ${a.address}, ${a.expiry ? `expiry: ${a.expiry}` : 'no expiry'}`).join('\n'),
                ].join('\n'),
            );
        }
    } else {
        // If there is more than one match, including expiry... well this
        // should not happen, because a Pendle token is completely
        // determined by type, market name and expiry... but we return
        // all the matches anyway
        return toResult(
            [
                `Found multiple matching Pendle assets for ${pendleTokenName} on ${toTitleCase(chainName)} chain with expiry ${shortExpiry}:`,
                byNameAndExpiry.map((a) => ` - ${a.name} on ${toTitleCase(chainName)} chain: ${a.address}, expiry: ${a.expiry}`).join('\n'),
            ].join('\n'),
        );
    }

    // This should never happen
    return toResult('No matching Pendle asset found');
}
