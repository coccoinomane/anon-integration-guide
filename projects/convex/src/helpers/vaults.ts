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

import { formatUnits, PublicClient } from 'viem';
import { Apy, LendingVault } from '../client';
import { CONVEX_TOKEN_DECIMALS } from '../constants';
import { calculateConvexTokenUsdPrice, ConvexTokenBalances, EnrichedConvexToken, fetchConvexTokenBalances } from './lps';
import { to$$$ } from './format';

/**
 * How much does a user owns of a Convex LV token, both staked and unstaked
 * (same structure as the LP counterpart)
 */
export type ConvexLvTokenBalances = ConvexTokenBalances;

/**
 * Return all relevant info about a Convex LV token, starting from
 * the API-returned `lendingVault` and `apy` objects (apy is optional).
 *
 * Optionally, pass the user account address to fetch the user balances.
 */
export async function enrichConvexLvToken(vault: LendingVault, provider: PublicClient, apy?: Apy, account?: `0x${string}`): Promise<EnrichedConvexToken> {
    // Compute base data
    const result: EnrichedConvexToken = {
        type: 'lv',
        id: vault.convexPoolData.id,
        isBrokenOrShutdown: vault.convexPoolData.shutdown,
        uiName: getConvexLvTokenUiName(vault),
        TVL: vault.convexPoolData.usdTotal ?? null,
        usdPrice: await calculateConvexTokenUsdPrice(vault, provider),
        curveId: vault.id,
        curveName: vault.name,
        curveTokenAddress: vault.address as `0x${string}`,
        apiObject: vault,
    };
    // Compute APY data if we have it
    if (apy) {
        result.apiApy = apy;
        result.uiApy = NaN;
    }
    // Compute full user balances if we have an account
    if (account) {
        const d = CONVEX_TOKEN_DECIMALS;
        result.userBalances = await fetchConvexTokenBalances(provider, vault.convexPoolData.id, account);
        result.userBalances.usdStaked = Number(formatUnits(result.userBalances.staked, d)) * result.usdPrice;
        result.userBalances.usdUnstaked = Number(formatUnits(result.userBalances.unstaked, d)) * result.usdPrice;
        result.userBalances.usdTotal = Number(result.userBalances.usdStaked + result.userBalances.usdUnstaked);
    }
    return result;
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

/**
 * Return a multiple line string with all data for the given Convex LV token
 */
export function formatConvexLvToken(convexLvToken: EnrichedConvexToken): string {
    let parts: string[] = [];
    parts.push(`Info on Convex LV token "${convexLvToken.uiName}":`);
    if (convexLvToken.userBalances) {
        const d = CONVEX_TOKEN_DECIMALS;
        const subParts: string[] = [];
        subParts.push(` - Your balance: ${formatUnits(convexLvToken.userBalances.total, d)} LV`);
        if (convexLvToken.userBalances.usdTotal) {
            subParts.push(` (${to$$$(convexLvToken.userBalances.usdTotal)})`);
        }
        if (convexLvToken.userBalances.unstaked) {
            subParts.push(` of which ${formatUnits(convexLvToken.userBalances.unstaked, d)}`);
            if (convexLvToken.userBalances.usdUnstaked) {
                subParts.push(` (${to$$$(convexLvToken.userBalances.usdUnstaked)})`);
            }
            subParts.push(` is unstaked`);
        }
        parts.push(subParts.join(''));
    }
    parts.push(` - Total TVL: ${convexLvToken.TVL ? to$$$(convexLvToken.TVL, 0, 0) : 'N/A'}`);
    parts.push(` - Convex ID: ${convexLvToken.id}`);
    parts.push(` - Underlying LP on Curve: "${convexLvToken.curveName}" with address ${convexLvToken.curveTokenAddress}`);
    if (convexLvToken.isBrokenOrShutdown) {
        parts.push(` - ⚠️ Curve pool is either broken or shutdown!`);
    }
    return parts.join('\n');
}

/**
 * Return a single line string with the most important data for the given
 * Convex LP pool.
 */
export function formatConvexLvTokenShort(convexLvToken: EnrichedConvexToken): string {
    let parts: string[] = [];
    parts.push(`Convex LV token "${convexLvToken.uiName}"`);
    parts.push(`with ID ${convexLvToken.id},`);
    parts.push(`underlying LP on Curve "${convexLvToken.curveName}",`);
    parts.push(`TVL ${convexLvToken.TVL ? to$$$(convexLvToken.TVL, 0, 0) : 'N/A'}`);
    if (convexLvToken.userBalances) {
        parts.push(`- you own ${formatUnits(convexLvToken.userBalances.total, CONVEX_TOKEN_DECIMALS)}`);
        if (convexLvToken.userBalances.usdTotal) {
            parts.push(`(${to$$$(convexLvToken.userBalances.usdTotal)})`);
        }
    }
    return parts.filter(Boolean).join(' ');
}
