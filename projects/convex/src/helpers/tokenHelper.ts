import { erc20Abi, PublicClient } from 'viem';
import axios from 'axios';
import { DEFAULT_TIMEOUT, HEYANON_NATIVE_TOKEN_ADDRESS } from '../constants';
import { staticMemoize } from './memoize';

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
 * Coin price information from Llama Finance API
 */
export interface CoinInfoFromLlama {
    chainId: number;
    chainName: string;
    address: `0x${string}`;
    decimals: number;
    symbol: string;
    price: number;
    timestamp: number;
    confidence: number;
}

/**
 * Helper class for token operations with memoization
 */
export class TokenHelper {
    /**
     * Given a token address, fetch from the blockchain its metadata
     *
     * Native tokens are identified by the
     * 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE address
     */
    @staticMemoize((provider: PublicClient, address: `0x${string}`) => {
        const chainId = provider.chain?.id ?? 'unknown';
        return `${chainId}:${address.toLowerCase()}`;
    })
    async getInfoFromAddress(provider: PublicClient, address: `0x${string}`): Promise<TokenInfo> {
        // If native token, return the default info
        if (address.toLowerCase() === HEYANON_NATIVE_TOKEN_ADDRESS.toLowerCase()) {
            if (!provider.chain) {
                throw new Error('Client error: chain not found');
            }
            return {
                address: HEYANON_NATIVE_TOKEN_ADDRESS,
                symbol: provider.chain.nativeCurrency.symbol,
                name: provider.chain.nativeCurrency.name,
                decimals: provider.chain.nativeCurrency.decimals,
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
        const contractResults = await provider.multicall({
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
     * Get the symbol for a given token address, with memoization to avoid
     * redundant blockchain calls.
     */
    @staticMemoize((provider: PublicClient, address: `0x${string}`) => {
        const chainId = provider.chain?.id ?? 'unknown';
        return `${chainId}:${address.toLowerCase()}`;
    })
    async getSymbol(provider: PublicClient, address: `0x${string}`): Promise<string> {
        const tokenInfo = await tokenHelper.getInfoFromAddress(provider, address);
        return tokenInfo.symbol;
    }

    /**
     * Get the token balance for a given account and token address.
     */
    async getBalance(provider: PublicClient, account: `0x${string}`, tokenAddress: `0x${string}`): Promise<bigint> {
        return await provider.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account],
        });
    }

    /**
     * Get the token balances for a given account across multiple
     * tokens.
     */
    async getBalances(provider: PublicClient, account: `0x${string}`, tokenAddresses: `0x${string}`[]): Promise<Record<string, bigint>> {
        // Multicall to get all token balances at once
        const balanceContractCalls = tokenAddresses.map((tokenAddress) => ({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account],
        }));

        const balanceResults = await provider.multicall({
            contracts: balanceContractCalls,
            allowFailure: true,
        });

        // Build result object mapping token addresses to balances
        const balances: Record<string, bigint> = {};
        for (let i = 0; i < tokenAddresses.length; i++) {
            if (balanceResults[i].status !== 'success') {
                throw new Error(`Could not fetch balance for token ${tokenAddresses[i]}`);
            }
            balances[tokenAddresses[i]] = balanceResults[i].result as bigint;
        }

        return balances;
    }

    /**
     * Get USD prices for multiple tokens across chains from Llama Finance API,
     * just as Convex UI does.
     *
     * Returns null if any error occurs (e.g. network error, invalid response).
     * Exclude tokens with confidence less than 90%.
     *
     * For details on the endpoint, see:
     * https://api-docs.defillama.com/#tag/coins/get/prices/current/{coins}
     *
     * @param tokens Array of objects with chainId and token address
     * @returns Record mapping "chain:address" to price info, or null on error
     */
    @staticMemoize((tokens: Array<{ chainId: number; address: string }>) => {
        // Create deterministic cache key by sorting tokens
        const sortedTokens = [...tokens].sort((a, b) => {
            if (a.chainId !== b.chainId) return a.chainId - b.chainId;
            return a.address.toLowerCase().localeCompare(b.address.toLowerCase());
        });
        return sortedTokens.map((t) => `${t.chainId}:${t.address.toLowerCase()}`).join(',');
    })
    async getInfoAndPriceFromAddressesUsingLlama(tokens: Array<{ chainId: number; address: `0x${string}` }>): Promise<CoinInfoFromLlama[] | null> {
        /**
         * Convert a numeric chain ID to the Llama Finance API chain name
         */
        function getChainNameForLlama(chainId: number): string {
            switch (chainId) {
                case 1:
                    return 'ethereum';
                case 42161:
                    return 'arbitrum';
                case 137:
                    return 'polygon';
                default:
                    throw new Error(`Unsupported chain ID: ${chainId}`);
            }
        }

        /**
         * Convert a Llama Finance API chain name to numeric chain ID
         */
        function getChainIdFromLlama(chainName: string): number {
            switch (chainName) {
                case 'ethereum':
                    return 1;
                case 'arbitrum':
                    return 42161;
                case 'polygon':
                    return 137;
                default:
                    throw new Error(`Unsupported chain name: ${chainName}`);
            }
        }

        // Call the Llama Finance API
        try {
            // Build the URL with chain:address pairs
            const tokenStrings = tokens.map((t) => {
                const chainName = getChainNameForLlama(t.chainId);
                return `${chainName}:${t.address.toLowerCase()}`;
            });
            const url = `https://coins.llama.fi/prices/current/${tokenStrings.join(',')}`;

            // Make the API call with timeout
            const response = await axios.get(url, {
                timeout: DEFAULT_TIMEOUT,
            });

            // Validate response structure
            if (!response.data || !response.data.coins) {
                console.warn('Invalid response structure from Llama Finance API');
                return null;
            }

            const coins = response.data.coins as Record<string, CoinInfoFromLlama>;

            // Exclude tokens with confidence less than 90%
            const filteredCoins = Object.entries(coins).filter(([key, coinInfo]) => {
                if (coinInfo.confidence && coinInfo.confidence < 0.9) {
                    console.warn(`Cannot get price for token ${key} due to low confidence (${coinInfo.confidence})`);
                    return false;
                }
                return true;
            });

            // Enrich the coin info with the chain ID and address
            const enrichedCoins = filteredCoins.map(([key, coinInfo]) => {
                const chainName = key.split(':')[0] as string;
                const address = key.split(':')[1] as `0x${string}`;
                const chainId = getChainIdFromLlama(chainName);
                return {
                    ...coinInfo,
                    chainName,
                    chainId,
                    address: address as `0x${string}`,
                };
            });

            return enrichedCoins;
        } catch (error) {
            console.warn('Error fetching USD prices from Llama Finance API:', error);
            return null;
        }
    }
}

/**
 * Singleton instance of TokenHelper for convenient access
 */
export const tokenHelper = new TokenHelper();
