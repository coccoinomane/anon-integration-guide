import { EVM, EvmChain } from '@heyanon/sdk';
import * as chains from 'viem/chains';
import { supportedChains } from '../constants';
import { toTitleCase } from './format';
import { defineChain } from 'viem';

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
        throw new Error(`Pendle Finance integration does not support chain named: ${chainName}`);
    }
    return getViemChainFromChainId(chainId);
}

/**
 * Get a viem chain object from a chain id
 */
export function getViemChainFromChainId(chainId: number): chains.Chain {
    // Special case for HyperEvm which is not supported by Viem
    if (chainId === 999) {
        return HyperEvmChain;
    }
    const viemChain = Object.values(chains).find((viemChain) => viemChain.id === chainId);
    if (!viemChain) {
        throw new Error(`Viem does not support chain with Id '${chainId}'`);
    }
    return viemChain;
}

/**
 * Custom chain definition for HyperEvm which is not supported by Viem
 */
export const HyperEvmChain = defineChain({
    id: 999,
    name: 'HyperEvm',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: {
            http: ['https://rpc.hyperliquid.xyz/evm', 'https://rpc.hypurrscan.io'],
            webSocket: ['wss://hyperliquid.drpc.org'],
        },
    },
    blockExplorers: {
        default: { name: 'Explorer', url: 'https://hyperevmscan.io' },
    },
    contracts: {
        multicall3: {
            address: '0xcA11bde05977b3631167028862bE2a173976CA11',
            blockCreated: 13051,
        },
    },
});
