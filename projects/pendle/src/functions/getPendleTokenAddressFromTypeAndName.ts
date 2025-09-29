import { FunctionOptions, FunctionReturn, toResult, EVM, EvmChain } from '@heyanon/sdk';
import { PendleAsset, PendleClient } from '../helpers/client';
import { supportedChains } from '../constants';
import { filterActiveAssets } from '../helpers/tokens';
import { toTitleCase } from '../helpers/format';

interface Props {
    chainName: string;
    /** type of the token */
    pendleTokenType: `${'PT' | 'YT' | 'SY' | 'LP'}`;
    /** name of the underlying token e.g. wstETH, USDe */
    underlyingTokenName: string;
    /** short expiry e.g. 26MAR2026  */
    shortExpiry: string | null;
}

const { getChainFromName } = EVM.utils;

export async function getPendleTokenAddressFromTypeAndName(
    { chainName, pendleTokenType, underlyingTokenName, shortExpiry }: Props,
    _options: FunctionOptions,
): Promise<FunctionReturn> {
    // Validation
    const chainId = getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${toTitleCase(chainName)}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Pendle is not supported on ${toTitleCase(chainName)}`, true);

    // Make sure the token type is in the correct format
    if (!['PT', 'YT', 'SY', 'LP'].includes(pendleTokenType)) {
        return toResult(`Invalid name for a Pendle token, must be "PT", "YT", "SY" or "LP": ${pendleTokenType}`, true);
    }

    // Make sure the token name is not empty
    if (!underlyingTokenName) {
        return toResult(`Pendle token name incomplete.  Please specify both the type (e.g. "PT", "YT", "SY", "LP") and the token name (e.g. "wstETH", "USDe")`, true);
    }

    // Label to refer to the token
    const tokenLabelNoExpiry = `${pendleTokenType} ${underlyingTokenName}`;

    // Get all Pendle assets from the API.
    //
    // Please note that with respect to the tool definition, Pendle token names
    // from the API include both the underlying token symbol (e.g. wstETH) and, in
    // parentheses, the maturation token (e.g. stETH), that is, the token to which
    // the PT token will convert to at expiration. For example, the name of the
    // principal token for the wstETH market is "PT wstETH (stETH)".
    //
    // Also worth noting is that Pendle token symbols contain only the symbol
    // of the maturation token (rather than the underlying token) and also include
    // the expiry date. For example, the symbol of the principal token for the
    // wstETH market is "PT-stETH-25DEC2025".
    const pendleClient = new PendleClient();
    let assets = await pendleClient.getAllAssets(chainId);

    // If no expiry date is specified, consider only active markets
    if (!shortExpiry) {
        assets = filterActiveAssets(assets, true);
    }

    // Do a first search by name/symbol
    let byLabel;
    if (pendleTokenType !== 'SY') {
        // For PT, YT and LP tokens, we do a partial search by NAME. It
        // is important to use the name instead of the symbol to reflect
        // Pendle UI, where the name (e.g. PT wstETH (stETH)) is shown
        // rather than the symbol (e.g. PT-stETH). Screenshot > https://d.pr/i/kM2EFC
        const query = `${pendleTokenType} ${underlyingTokenName}`;
        byLabel = assets.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));
    } else {
        // For SY tokens, we do a partial search by SYMBOL, because the token
        // name of SY tokens is chosen to be just the name of the underlying token
        // to avoid confusion on the Pendle UI.  The symbol, however, does include
        // the "SY-" prefix which we can use to disambiguate.
        const query = `SY-${underlyingTokenName}`;
        byLabel = assets.filter((a) => a.symbol.toLowerCase().includes(query.toLowerCase()));
    }

    // If no results are found, let's try searching by market name instead
    if (byLabel.length === 0) {
        // Filter markets using the token name provided by the user
        let markets = await pendleClient.getActiveMarkets(chainId);
        markets = markets.filter((m) => m.name.toLowerCase().includes(underlyingTokenName.toLowerCase()));
        if (markets.length === 0) {
            return toResult(`Could not find the Pendle asset '${tokenLabelNoExpiry}' on ${toTitleCase(chainName)}`);
        }
        // Map markets to Pendle assets of the type requested by the user
        const byMarketName: (PendleAsset | null)[] = markets.map((m) => {
            let address = '';
            const tokenType = pendleTokenType.toLowerCase() as 'pt' | 'yt' | 'sy' | 'lp';
            if (tokenType === 'lp') {
                address = m.address;
            } else {
                address = m[tokenType];
                address = address.split('-')[1] as `0x${string}`;
            }
            if (!address) {
                return null;
            }
            const asset = assets.find((a) => a.address === address);
            return asset || null;
        });
        // Filter out null values
        const byMarketNameFiltered = byMarketName.filter(Boolean) as PendleAsset[];
        // Suggest the user the possible matches
        return toResult(
            [
                `Could not find an exact match for token '${tokenLabelNoExpiry}', maybe you meant ${byMarketNameFiltered.length > 1 ? 'one of these tokens' : 'this token'}?`,
                byMarketNameFiltered.map((a) => formatPendleAsset(a, chainName, ' - ')).join('\n'),
            ].join('\n'),
        );
    }

    // Case where no expiry date was specified
    if (!shortExpiry) {
        // If there is only one result, return that result
        if (byLabel.length === 1) {
            return toResult(formatPendleAsset(byLabel[0], chainName));
        } else {
            // If there is more than one result, return all of them
            // warning the user that there are multiple results
            return toResult([`Found multiple Pendle assets matching '${tokenLabelNoExpiry}':`, byLabel.map((a) => formatPendleAsset(a, chainName, ' - ')).join('\n')].join('\n'));
        }
    }

    // Further filter by expiry date.  We use the symbol
    // to filter as it contains the expiry date in short format
    // e.g. PT-stETH-30MAR2026
    const byLabelAndExpiry = byLabel.filter((a) => a.symbol.toLowerCase().includes(shortExpiry.toLowerCase()));

    // If there is a single match, return it
    if (byLabelAndExpiry.length === 1) {
        return toResult(formatPendleAsset(byLabelAndExpiry[0], chainName));
    } else if (byLabelAndExpiry.length === 0) {
        // If nothing matches, tell the user and/or show them
        // solutions with different expiry dates
        if (byLabel.length === 0) {
            return toResult(`Could not find any Pendle asset matching '${tokenLabelNoExpiry}' with the requested expiry on ${toTitleCase(chainName)} chain`);
        }
        if (byLabel.length > 0) {
            return toResult(
                [
                    `Found Pendle assets matching '${tokenLabelNoExpiry}' but none of them has the requested expiry:`,
                    byLabel.map((a) => formatPendleAsset(a, chainName, ' - ')).join('\n'),
                ].join('\n'),
            );
        }
    } else {
        // Rare case in which type, underlying name and expiry are not enough to
        // uniquely determine a Pendle token.  This might happen if two marketes
        // differ only in the maturation token, e.g. "PT wstETH (stETH)" and
        // "PT wstETH (ETH)".  (Not sure these exist... but just in case.)
        return toResult(
            [
                `Found multiple Pendle assets for '${tokenLabelNoExpiry}' with the requested expiry:`,
                byLabelAndExpiry.map((a) => formatPendleAsset(a, chainName, ' - ')).join('\n'),
            ].join('\n'),
        );
    }

    // This should never happen
    return toResult('No matching Pendle asset found');
}

/**
 * Given a Pendle asset, format it to a string
 */
function formatPendleAsset(asset: PendleAsset, chainName: string, prefix: string = ''): string {
    let tokenLabelToPrint = asset.name;
    if (asset.tags[0].includes('SY')) {
        tokenLabelToPrint = asset.symbol;
    }
    return `${prefix}${tokenLabelToPrint} on ${toTitleCase(chainName)} chain: ${asset.address}, ${asset.expiry ? `expiry: ${asset.expiry}` : 'no expiry'}`;
}
