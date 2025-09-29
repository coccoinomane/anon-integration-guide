import { Chain, EvmChain, EVM } from '@heyanon/sdk';

export interface TokenInfo {
    type: 'erc20' | 'native';
    symbol: string;
    name: string;
    chainId: number;
    address: `0x${string}`;
    decimals: number;
}

/**
 * List of tokens that the agent will be able to resolve from their symbol
 */
export const tokens: Partial<Record<EvmChain, TokenInfo[]>> = {
    [Chain.ETHEREUM]: [
        {
            type: 'native',
            symbol: 'ETH',
            name: 'Ethereum',
            chainId: EVM.constants.ChainIds[Chain.ETHEREUM],
            address: EVM.constants.NATIVE_ADDRESS,
            decimals: 18,
        },
        {
            type: 'erc20',
            symbol: 'USDC',
            name: 'USDC',
            chainId: EVM.constants.ChainIds[Chain.ETHEREUM],
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            decimals: 6,
        },
    ],
    [Chain.BASE]: [
        {
            type: 'native',
            symbol: 'ETH',
            name: 'Ethereum',
            chainId: EVM.constants.ChainIds[Chain.BASE],
            address: EVM.constants.NATIVE_ADDRESS,
            decimals: 18,
        },
        {
            type: 'erc20',
            symbol: 'WETH',
            name: 'Wrapped Ethereum',
            chainId: EVM.constants.ChainIds[Chain.BASE],
            address: '0x4200000000000000000000000000000000000006',
            decimals: 18,
        },
        {
            type: 'erc20',
            symbol: 'USDC',
            name: 'USDC',
            chainId: EVM.constants.ChainIds[Chain.BASE],
            address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            decimals: 6,
        },
        {
            type: 'erc20',
            symbol: 'USDE',
            name: 'Ethena USDe',
            chainId: EVM.constants.ChainIds[Chain.BASE],
            address: '0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34',
            decimals: 18,
        },
        {
            type: 'erc20',
            symbol: 'WBTC',
            name: 'Wrapped BTC',
            chainId: EVM.constants.ChainIds[Chain.BASE],
            address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
            decimals: 8,
        },
        {
            type: 'erc20',
            symbol: 'YOETH',
            name: 'yoETH Token',
            chainId: EVM.constants.ChainIds[Chain.BASE],
            address: '0x3a43aec53490cb9fa922847385d82fe25d0e9de7',
            decimals: 18,
        },
    ],
};

/**
 * Return token details from its symbol
 */
export function getTokenInfoFromSymbol(chainName: EvmChain, symbol: string): TokenInfo | null {
    const chainTokens = tokens[chainName];
    if (!chainTokens) return null;
    return chainTokens.find((token) => token.symbol.toUpperCase() === symbol.toUpperCase()) || null;
}
