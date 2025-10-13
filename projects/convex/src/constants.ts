import { Chain, EVM } from '@heyanon/sdk';

const { ChainIds } = EVM.constants;

/**
 * Chains supported by the integration.
 *
 * As of Oct 2025:
 * - Convex supports Frax chain, but it is not supported by HeyAnon SDK yet
 * - Only Ethereum (and Fraxtal) supports staking lending  positions
 * - CRV & CVX staking is only supported on Ethereum
 * - cvxCRV is heavily depegged, so if you convert CRV to cvxCRV directly you will lose money (better to swap) > https://www.defiwars.xyz/projects/convex
 */
export const supportedChains = [ChainIds[Chain.ETHEREUM], ChainIds[Chain.ARBITRUM], ChainIds[Chain.POLYGON]];

/**
 * Addresses of the Convex Booster contract
 * (same address on all supported chains:
 * Ethereum, Arbitrum, Polygon)
 */
export const CONVEX_BOOSTER_CONTRACT_ADDRESS: `0x${string}` = '0xF403C135812408BFbE8713b5A23a04b3D48AAE31';

/**
 * The number of decimals for the Convex LP token deposit tokens
 */
export const CONVEX_LP_TOKEN_DECIMALS = 18;

/**
 * Maximum number of positions to show when calling the portfolio tool
 */
export const MAX_POSITIONS_IN_RESULTS = 30;

/**
 * Types of positions a user can hold on Convex Finance
 */
export const CONVEX_POSITION_TYPES = ['CRV_CVX', 'CVX', 'LIQUIDITY_POOL', 'LENDING_VAULT'] as const;

/**
 * The address used by HeyAnon SDK to identify the native token
 */
export const HEYANON_NATIVE_TOKEN_ADDRESS = EVM.constants.NATIVE_ADDRESS;

/**
 * The default precision used to show token amounts,
 * expressed as a number of significant digits.
 */
export const DEFAULT_PRECISION = 6;
