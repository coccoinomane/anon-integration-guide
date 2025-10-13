import { Chain, EVM } from '@heyanon/sdk';

const { ChainIds } = EVM.constants;

/**
 * Maximum number of positions to show when calling the portfolio tool
 */
export const MAX_POSITIONS_IN_RESULTS = 30;

/**
 * Chains supported by the integration.
 * Convex supports Ethereum and Frax chain, however Frax chain
 * is not supported by HeyAnon SDK yet.
 */
export const supportedChains = [ChainIds[Chain.ETHEREUM]];

/**
 * The address used by HeyAnon SDK to identify the native token
 */
export const HEYANON_NATIVE_TOKEN_ADDRESS = EVM.constants.NATIVE_ADDRESS;

/**
 * The default precision used to show token amounts,
 * expressed as a number of significant digits.
 */
export const DEFAULT_PRECISION = 6;
