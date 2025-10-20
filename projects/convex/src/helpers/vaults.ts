/**
 * This file contains utility functions to work with Convex Lending
 * Vault (LV) tokens.
 *
 * A Convex LV token is a deposit/receipt token that the user receives
 * in exchange for depositing on Convex a lending position created on
 * Curve's Llamalend protocol. To obtain a lending position suitable for
 * being deposited on Curve, the user has to deposit their crvUSD tokens
 * in a Llamalend vault (e.g. https://www.curve.finance/lend/ethereum/markets/one-way-market-12/vault/deposit).
 * Each Llamalend vault has a specific collateral (e.g. WETH) hence
 * Convex LV tokens shown on Convex UI always contain a token name
 * (screnshot > https://d.pr/i/DpYS2p)
 *
 * The Convex LV token can then be further staked on Convex to earn
 * boosted CRV rewards (if any) and CVX rewards (if any).
 *
 * Please note that at the smart contract level there does not seem
 * to be significant difference between Convex LP and LV tokens, at
 * least for the external-facing functionalities, hence here we re-use
 * much of the code from LP helpers in lps.ts.
 */

import { LendingVault } from '../client';

/**
 * Calculate the USD price of a Convex LV token
 * by dividing the TVL by the total number of shares
 */
export function calculateConvexLvTokenUsdPrice(vault: LendingVault): number {
    const tvl = vault.totalSupplied.usdTotal;
    const totalSupply = vault.vaultShares.totalShares;
    return tvl ? tvl / totalSupply : NaN;
}

/**
 * Name shown on the website UI for the given LV token.
 * This is given by the borrowed token (which seems to be
 * always crvUSD) followed by the collateral token symbol
 * in parentheses
 * e.g. https://d.pr/i/DpYS2p
 */
export function getConvexLvTokenUiName(vault: LendingVault): string {
    return `${vault.assets.borrowed.symbol} (${vault.assets.collateral.symbol} collateral)`;
}
