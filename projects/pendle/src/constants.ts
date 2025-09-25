import { Chain, EVM } from '@heyanon/sdk';

const { ChainIds } = EVM.constants;

/**
 * Supported chains are shown in the UI at
 * https://app.pendle.finance/trade/markets
 * Excluding Berachain and Mantle here as they
 * are not supported by HeyAnon SDK yet.
 */
export const supportedChains = [
    ChainIds[Chain.ETHEREUM],
    ChainIds[Chain.SONIC],
    ChainIds[Chain.BASE],
    ChainIds[Chain.ARBITRUM],
    ChainIds[Chain.BSC],
    ChainIds[Chain.OPTIMISM],
    ChainIds[Chain.HYPEREVM],
];

/**
 * Maximum number of positions to show when calling the portfolio tool
 */
export const MAX_POSITIONS_IN_RESULTS = 50;

/**
 * Maximum number of liquidity pools to show in the search results
 */
export const MAX_LIQUIDITY_POOLS_IN_RESULTS = 10;

/**
 * Maximum number of marketes to show in the search results
 */
export const MAX_MARKETS_IN_RESULTS = 10;

/**
 * Minimum $ liquidity for a market to appear in search results
 */
export const MIN_LIQUIDITY_FOR_MARKET = 100000;
