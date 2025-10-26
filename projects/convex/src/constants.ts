import { Chain, EVM } from '@heyanon/sdk';

const { ChainIds } = EVM.constants;

/**
 * Chains supported by the integration.
 *
 * As of Oct 2025, this integration supports only Ethereum,
 * where 96% of Convex TVL is concentrated
 */
export const supportedChains = [ChainIds[Chain.ETHEREUM]];

/**
 * Addresses of the Convex Booster contract on Ethereum
 * (same on Arbitrum and Polygon)
 */
export const CONVEX_BOOSTER_CONTRACT_ADDRESS: `0x${string}` = '0xF403C135812408BFbE8713b5A23a04b3D48AAE31';

/**
 * Address of the Convex PoolUtilities contract on Ethereum
 */
export const POOL_UTILITIES_CONTRACT_ADDRESS: `0x${string}` = '0x5Fba69a794F395184b5760DAf1134028608e5Cd1';

/**
 * Address of the Convex CVX ERC20 token on Ethereum
 */
export const CVX_TOKEN_ADDRESS: `0x${string}` = '0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b';

/**
 * Address of the Curve CRV ERC20 token on Ethereum
 */
export const CRV_TOKEN_ADDRESS: `0x${string}` = '0xD533a949740bb3306d119CC777fa900bA034cd52';

/**
 * Address of the CvxMining contract on Ethereum,
 * which is used to get CVX rewards from CRV
 */
export const CVX_MINING_CONTRACT_ADDRESS: `0x${string}` = '0x3c75BFe6FbfDa3A94E7E7E8c2216AFc684dE5343';

/**
 * The number of decimals for the Convex LP token deposit tokens
 *
 * It is guaranteed to be 18 since "we only deal with curve lp
 * tokens and not the underlying tokens on the amm etc"
 *
 * Source: C2tP on Discord
 * https://discord.com/channels/820795644494610432/864157305566527508/1427239246279868437
 */
export const CONVEX_TOKEN_DECIMALS = 18;

/**
 * Maximum number of positions to show when calling the portfolio tool
 */
export const N_MAX_RESULTS_IN_PORTFOLIO = 30;

/**
 * Maximum number of positions to show when calling the best yield tool
 */
export const N_MAX_RESULTS_IN_BEST_YIELD = 15;

/**
 * Minimum TVL in dollars for a Convex pool or vault to be shown
 * in the list tool.  For the portfolio tool, this acts as a default
 * value for the minTvl argument.
 */
export const MIN_TVL = 50_000;

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

/**
 * Maximum number of contract calls to include in a single multicall batch.
 * This helps avoid issues with RPC providers that have limits on multicall size.
 *
 * Note: Each pool/vault requires 2 calls (staked + unstaked balance),
 * so this batch size will handle 20 pools/vaults per batch.
 */
export const MULTICALL_BATCH_SIZE = 40;
