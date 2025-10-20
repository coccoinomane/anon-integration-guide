import { erc20Abi, PublicClient } from 'viem';
import { HEYANON_NATIVE_TOKEN_ADDRESS } from '../constants';
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
}

/**
 * Singleton instance of TokenHelper for convenient access
 */
export const tokenHelper = new TokenHelper();
