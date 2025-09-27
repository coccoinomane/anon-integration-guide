import { erc20Abi, PublicClient } from 'viem';
import { HEYANON_NATIVE_TOKEN_ADDRESS, PENDLE_NATIVE_TOKEN_ADDRESS } from '../constants';
import { PendleAsset } from './client';

/**
 * Basic info about an ERC20 token
 */
export interface TokenInfo {
    address: `0x${string}`;
    symbol: string;
    name: string;
    decimals: number;
}

/**
 * Given a token address, fetch from the blockchain its metadata
 *
 * Please note that here we also convert native tokens addresses from the
 * HeyAnon value (0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee) to the Pendle
 * value (0x0000000000000000000000000000000000000000)
 */
export async function fetchTokenInfoFromAddress(publicClient: PublicClient, address: `0x${string}`): Promise<TokenInfo> {
    // If native token, return the default info
    if (address.toLowerCase() === HEYANON_NATIVE_TOKEN_ADDRESS.toLowerCase()) {
        if (!publicClient.chain) {
            throw new Error('Client error: chain not found');
        }
        return {
            address: PENDLE_NATIVE_TOKEN_ADDRESS,
            symbol: publicClient.chain.nativeCurrency.symbol,
            name: publicClient.chain.nativeCurrency.name,
            decimals: publicClient.chain.nativeCurrency.decimals,
        };
    }

    // Build a 3-call multicall to get the token info
    const contractCalls = ['symbol', 'name', 'decimals'].map((functionName) => ({
        address,
        abi: erc20Abi,
        functionName,
        args: [],
    }));

    // Execute the multicall
    const contractResults = await publicClient.multicall({
        contracts: contractCalls,
        allowFailure: true,
    });

    // Check there were no failures
    for (const result of contractResults) {
        if (result.status !== 'success') {
            throw new Error(`Could not fetch info on token ${address}, please ensure it exists and retry`);
        }
    }

    // Extract and validate the results
    const symbol = contractResults[0]?.result ?? null;
    const name = contractResults[1]?.result ?? null;
    const decimals = contractResults[2]?.result ?? null;

    if (symbol === null || name === null || decimals === null) {
        throw new Error(`Could not find info on token ${address}`);
    }

    if (typeof decimals !== 'number' || !Number.isInteger(decimals)) {
        throw new Error(`Decimals for token ${address} is not an integer number`);
    }

    // Return the token info
    return {
        address,
        symbol: symbol as string,
        name: name as string,
        decimals,
    };
}

/**
 * Given a list of Pendle assets, return only those with expiry dates in the future
 */
export function filterActiveAssets(allAssets: PendleAsset[], keepSyTokens: boolean = true): PendleAsset[] {
    const now = new Date();

    return allAssets.filter((asset) => {
        // If asset has no expiry, it's not a time-bound asset (like SY tokens)
        // and should always be included
        if (!asset.expiry) {
            return keepSyTokens;
        }

        // Parse the expiry date and check if it's in the future, and include it if it is
        const expiryDate = new Date(asset.expiry);
        return expiryDate > now;
    });
}
