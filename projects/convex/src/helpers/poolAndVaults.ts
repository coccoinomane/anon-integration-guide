/**
 * This file contains utility functions to work with Convex
 * pool tokens and lending vault tokens.  Please refer to the
 * README.md file for more details about differences and similarities
 * between the two types of tokens.
 */

import { formatUnits, PublicClient } from 'viem';
import { Apy, ConvexCurveClient, LendingVault, Pool } from '../client';
import { CONVEX_TOKEN_DECIMALS, CRV_TOKEN_ADDRESS, CVX_TOKEN_ADDRESS } from '../constants';
import { to$$$, toTitleCase } from './format';
import { AprBreakdown, calculateConvexApr } from './apr';
import { getChainNameFromProvider } from './chains';
import Big from 'big.js';
import { fetchConvexTokenBalancesFromApiObject } from './balances';

/**
 * How much does a user owns of a Convex token, both
 * staked and unstaked
 */
export type ConvexTokenBalances = {
    staked: bigint; // Amount staked in reward pool earning rewards
    usdStaked?: number; // USD value of the staked amount
    unstaked: bigint; // Amount of deposit tokens in wallet (not staked)
    usdUnstaked?: number; // USD value of the unstaked amount
    total: bigint; // Staked + unstaked amount
    usdTotal?: number; // USD value of the staked + unstaked amount
    underlying: bigint; // Amount of underlying Curve LP or Vault tokens in wallet
    usdUnderlying?: number; // USD value of the underlying amount
};

/**
 * All relevant info about a Convex token, including the
 * API-returned data, derived data, and the user's balances.
 *
 * APRs and APYs are expressed as percents (5.2 means 5.2%)
 */
export type EnrichedConvexToken = {
    /** The type of token, either a Convex pool Token or Convex vault Token */
    type: 'LP' | 'LV';
    typeLabel: 'Liquidity Pool' | 'Lending Vault';
    typeLabelShort: 'pool' | 'vault';
    tokensLabel: 'LP tokens' | 'vault tokens';
    id: number;
    isBrokenOrShutdownOrKilled: boolean;
    uiName: string;
    /** The base APR for the token: swap fees for pools, lending interest for vaults */
    baseApr?: number;
    uiApr?: number;
    uiAprBreakdown?: AprBreakdown;
    uiApy?: number;
    TVL: number | null;
    usdPrice: number;
    userBalances?: ConvexTokenBalances;
    curveId: string;
    curveName: string;
    curveTokenAddress: `0x${string}`;
    /** The API-returned object, either a Pool or a LendingVault */
    apiObject: Pool | LendingVault;
    apiApyObject?: Apy;
};

/**
 * Compute and return all relevant info about a Convex token,
 * given the API-returned `Pool` or `LendingVault` object
 *
 * Optionally:
 * - pass the user account address to fetch the user balances
 *   (takes 1 request to the blockchain)
 * - pass the APY object to compute the APR and APY (takes 1
 *   request to the blockchain)
 */
export async function enrichConvexToken(obj: Pool | LendingVault, provider: PublicClient, apyFromApi?: Apy, account?: `0x${string}`): Promise<EnrichedConvexToken> {
    // Determine the type of token
    let type: 'LP' | 'LV';
    if (isPool(obj)) {
        type = 'LP';
    } else if (isLendingVault(obj)) {
        type = 'LV';
    } else {
        throw new Error('Could not determine the type of token (LP or Lending vault)');
    }
    // Determine whether the pool is broken, shutdown, or killed
    let isBrokenOrShutdownOrKilled: boolean;
    if (isPool(obj)) {
        isBrokenOrShutdownOrKilled = obj.isBroken || obj.convexPoolData.shutdown || obj.isGaugeKilled;
    } else {
        isBrokenOrShutdownOrKilled = obj.convexPoolData.shutdown || obj.isGaugeKilled;
    }
    // Compute base data
    const lpTokenPrice = calculateTokenUsdPrice(obj);
    const result: EnrichedConvexToken = {
        type,
        typeLabel: type === 'LP' ? 'Liquidity Pool' : 'Lending Vault',
        typeLabelShort: type === 'LP' ? 'pool' : 'vault',
        tokensLabel: type === 'LP' ? 'LP tokens' : 'vault tokens',
        id: obj.convexPoolData.id,
        isBrokenOrShutdownOrKilled,
        uiName: isPool(obj) ? getConvexLpTokenUiName(obj) : getConvexLvTokenUiName(obj),
        TVL: obj.convexPoolData.usdTotal ?? null,
        usdPrice: lpTokenPrice,
        curveId: obj.id,
        curveName: obj.name,
        curveTokenAddress: isPool(obj) ? obj.lpTokenAddress : obj.address,
        apiObject: obj,
    };
    // Compute APR data if we have it
    if (apyFromApi) {
        const chainName = getChainNameFromProvider(provider);
        const cvxPrice = await new ConvexCurveClient().cvxPrice(chainName);
        const tokenPrices = {
            [CRV_TOKEN_ADDRESS.toLowerCase()]: apyFromApi.crvPrice ?? 0,
            [CVX_TOKEN_ADDRESS.toLowerCase()]: cvxPrice ?? 0,
        };
        const aprResult = await calculateConvexApr({
            poolId: obj.convexPoolData.id,
            tokenPrices,
            lpTokenPrice,
            provider,
        });
        result.apiApyObject = apyFromApi;
        result.baseApr = isPool(obj) ? obj.baseApy : obj.rates.lendApyPcent;
        result.uiApr = aprResult.totalAPR + result.baseApr;
        result.uiAprBreakdown = aprResult;

        // Compute APY data from APR assuming daily compounding
        if (aprResult.totalAPR > 0) {
            const compoundingFrequency = 365;
            const aprDecimal = new Big(result.uiApr).div(100);
            const base = new Big(1).plus(aprDecimal.div(compoundingFrequency));
            result.uiApy = base.pow(compoundingFrequency).minus(1).times(100).toNumber();
        }
    }
    // Compute full user balances if we have an account
    if (account) {
        result.userBalances = await fetchConvexTokenBalancesFromApiObject(provider, obj, account, true);
    }
    return result;
}

/**
 * Type guard to check if an object is a Pool
 * Discriminates based on the presence of the lpTokenAddress property
 */
export function isPool(poolOrVault: Pool | LendingVault): poolOrVault is Pool {
    return 'lpTokenAddress' in poolOrVault;
}

/**
 * Type guard to check if an object is a LendingVault
 * Discriminates based on the presence of the borrowed property
 */
export function isLendingVault(poolOrVault: Pool | LendingVault): poolOrVault is LendingVault {
    return 'borrowed' in poolOrVault;
}

/**
 * Calculate the USD price of a Convex token (LP or LV)
 * This is a unified helper that works for both Pool and LendingVault types
 */
export function calculateTokenUsdPrice(poolOrVault: Pool | LendingVault): number {
    if (isLendingVault(poolOrVault)) {
        return calculateConvexLvTokenUsdPrice(poolOrVault);
    } else {
        return calculateConvexLpTokenUsdPrice(poolOrVault);
    }
}

/**
 * Name shown on the website UI for the given LP or LV token.
 */
export function getConvexTokenUiName(poolOrVault: Pool | LendingVault): string {
    return isPool(poolOrVault) ? getConvexLpTokenUiName(poolOrVault) : getConvexLvTokenUiName(poolOrVault);
}

/**
 * Return a multiple line string with all data for the given
 * Convex token, including the user's balances
 */
export function formatConvexToken(ct: EnrichedConvexToken, includeIntro: boolean = true): string {
    let parts: string[] = [];
    if (includeIntro) {
        parts.push(`Info on Convex ${ct.typeLabel} token "${ct.uiName}":`);
    }
    if (ct.userBalances) {
        const d = CONVEX_TOKEN_DECIMALS;
        const subParts: string[] = [];
        if (ct.userBalances.total > 0n) {
            subParts.push(` - You own ${formatUnits(ct.userBalances.total, d)} ${ct.tokensLabel} on Convex`);
        } else {
            subParts.push(` - You have not deposited any ${ct.tokensLabel} on Convex yet`);
        }
        if (ct.userBalances.usdTotal) {
            subParts.push(` (${to$$$(ct.userBalances.usdTotal)})`);
        }
        if (ct.userBalances.unstaked > 0n) {
            subParts.push(` of which ${formatUnits(ct.userBalances.unstaked, d)}`);
            if (ct.userBalances.usdUnstaked) {
                subParts.push(` (${to$$$(ct.userBalances.usdUnstaked)})`);
            }
            subParts.push(` are unstaked`);
        } else if (ct.userBalances.total > 0n && ct.userBalances.unstaked === 0n) {
            subParts.push(`, all staked`);
        }
        parts.push(subParts.join(''));
        if (ct.userBalances.underlying > 0n) {
            parts.push(
                ` - You own ${formatUnits(ct.userBalances.underlying, d)} ${ct.tokensLabel} of the underlying Curve ${ct.typeLabelShort}, which you can deposit on Convex to earn rewards`,
            );
            if (ct.userBalances.usdUnderlying) {
                parts[parts.length - 1] += ` (${to$$$(ct.userBalances.usdUnderlying)})`;
            }
        } else if (ct.userBalances.underlying === 0n) {
            parts.push(` - You own no Curve ${ct.tokensLabel} to deposit on Convex`);
        }
    }
    parts.push(` - Total TVL: ${ct.TVL ? to$$$(ct.TVL, 0, 0) : 'N/A'}`);
    parts.push(` - Total APR: ${typeof ct.uiApr === 'number' && ct.uiApr >= 0 ? `${ct.uiApr.toFixed(2)}%` : 'N/A'}`);
    if (ct.uiApr && ct?.uiAprBreakdown?.breakdown && ct.uiAprBreakdown.breakdown.length > 0) {
        let aprParts = [];
        aprParts.push(`base APR: ${ct.baseApr?.toFixed(3)}%`);
        ct.uiAprBreakdown.breakdown.forEach((b) => aprParts.push(`${b.tokenSymbol} rewards: ${b.apr.toFixed(3)}%`));
        parts[parts.length - 1] += ' (' + aprParts.join(', ') + ')';
    }
    if (ct.uiApy) {
        parts.push(` - Total APY: ${ct.uiApy >= 0 ? `${ct.uiApy.toFixed(2)}%` : 'N/A'}`);
    }
    parts.push(` - Convex ID: ${ct.id}`);
    parts.push(` - Underlying ${ct.typeLabelShort} on Curve: "${ct.curveName}" with Curve ID "${ct.curveId}"`);
    if (ct.isBrokenOrShutdownOrKilled) {
        parts.push(` - ⚠️ ${toTitleCase(ct.typeLabelShort)} may not be active anymore`);
    }
    return parts.join('\n');
}

/**
 * Return a single line string with the most important data for the given
 * Convex token, including the user's balances
 */
export function formatConvexTokenShort(ct: EnrichedConvexToken): string {
    const d = CONVEX_TOKEN_DECIMALS;
    let parts: string[] = [];
    parts.push(`Convex ${ct.typeLabelShort} token ${ct.uiName}`);
    parts.push(` with ID ${ct.id},`);
    parts.push(` underlying ${ct.typeLabelShort} on Curve "${ct.curveName}" with Curve ID "${ct.curveId}",`);
    parts.push(` TVL ${ct.TVL ? to$$$(ct.TVL, 0, 0) : 'N/A'}`);
    parts.push(`, Total APR: ${ct.uiApr && ct.uiApr >= 0 ? `${ct.uiApr.toFixed(2)}%` : 'N/A'}`);
    if (ct.userBalances) {
        if (ct.userBalances.total > 0n) {
            parts.push(` - you own ${formatUnits(ct.userBalances.total, d)} ${ct.tokensLabel} on Convex`);
            if (ct.userBalances.usdTotal) {
                parts.push(` (${to$$$(ct.userBalances.usdTotal)})`);
            }
            if (ct.userBalances.underlying > 0n) {
                parts.push(` and you can deposit ${formatUnits(ct.userBalances.underlying, d)} ${ct.tokensLabel} more`);
                if (ct.userBalances.usdUnderlying) {
                    parts.push(` (${to$$$(ct.userBalances.usdUnderlying)})`);
                }
            }
        } else if (ct.userBalances.underlying > 0n) {
            parts.push(` - you can deposit ${formatUnits(ct.userBalances.underlying, d)} ${ct.tokensLabel} on Convex`);
        }
    }
    if (ct.isBrokenOrShutdownOrKilled) {
        parts.push(` ⚠️ ${toTitleCase(ct.typeLabelShort)} may not be active anymore`);
    }
    return parts.filter(Boolean).join('');
}

/**
 * Whether to include a position in the results of the
 * listing tools (getMyPositionsPortfolio and getBestYieldOpportunitiesForUnderlyingToken)
 */
export function shouldIncludePosition(poolOrVault: Pool | LendingVault, minTvl: number): boolean {
    const conditions: boolean[] = [];
    conditions.push(poolOrVault.convexPoolData.usdTotal >= minTvl);
    conditions.push(!isPoolOrVaultInactive(poolOrVault));
    return conditions.every((condition) => condition);
}

/**
 * Whether a pool or vault is inactive, i.e. broken, shutdown or killed
 */
export function isPoolOrVaultInactive(poolOrVault: Pool | LendingVault): boolean {
    const conditions: boolean[] = [];
    conditions.push(poolOrVault.isGaugeKilled);
    conditions.push(poolOrVault.convexPoolData.shutdown);
    if (isPool(poolOrVault)) {
        conditions.push(poolOrVault.isBroken);
    }
    return conditions.some((condition) => condition);
}

/**
 * Calculate the USD price of a Convex LP token
 * by dividing the TVL by the total supply
 */
export function calculateConvexLpTokenUsdPrice(pool: Pool): number {
    const d = CONVEX_TOKEN_DECIMALS;
    const tvl = pool.usdTotal;
    const totalSupply = pool.totalSupply; // could fetch it from the blockchain, but it's in the API response
    return tvl ? tvl / Number(formatUnits(BigInt(totalSupply), d)) : NaN;
}

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
 * Name shown on the website UI for the given LP token.
 * This is given by the pool tokens symbols joined by a plus sign
 * e.g. https://d.pr/i/WoXJrD
 */
export function getConvexLpTokenUiName(pool: Pool): string {
    return pool.coins.map((coin) => coin.symbol).join('+');
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
