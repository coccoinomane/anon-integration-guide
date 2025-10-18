import { EVM, EvmChain } from '@heyanon/sdk';
import * as chains from 'viem/chains';
import { supportedChains } from '../constants';
import { toTitleCase } from './format';
import { PublicClient } from 'viem';

const { getChainName } = EVM.utils;

/**
 * Get the chain name from the chain id
 */
export function getChainNameFromChainId(chainId: number, titleCase: boolean = true): string {
    const chainName = getChainName(chainId);
    if (!chainName) {
        throw new Error(`Chain id ${chainId} not found`);
    }
    return titleCase ? toTitleCase(chainName) : chainName;
}

/**
 * Convert a HeyAnon chain name to a viem chain object; throws an error
 * if the chain is not supported by Hey Anon or viem.
 */
export function getViemChainFromAnonChainName(chainName: string): chains.Chain {
    const chainId = EVM.utils.getChainFromName(chainName as EvmChain);
    if (!chainId) {
        throw new Error(`HeyAnon does not support chain named: ${chainName}`);
    }
    if (!supportedChains.includes(chainId)) {
        throw new Error(`Convex Finance integration does not support chain named: ${chainName}`);
    }
    return getViemChainFromChainId(chainId);
}

/**
 * Get a viem chain object from a chain id
 */
export function getViemChainFromChainId(chainId: number): chains.Chain {
    const viemChain = Object.values(chains).find((viemChain) => viemChain.id === chainId);
    if (!viemChain) {
        throw new Error(`Viem does not support chain with Id '${chainId}'`);
    }
    return viemChain;
}

/**
 * Helper function that returns the chain ID from a viem provider.
 * Throws an error if the chain ID is not found.
 */
export function getChainIdFromProvider(provider: PublicClient): number {
    if (!provider.chain) throw new Error('Could not find chain ID from provider');
    return provider.chain.id;
}

/**
 * Helper function that returns the HeyAnon chain name from a viem provider.
 * Throws an error if the chain is not found.
 */
export function getChainNameFromProvider(provider: PublicClient): string {
    const chainId = getChainIdFromProvider(provider);
    return getChainNameFromChainId(chainId, false);
}
