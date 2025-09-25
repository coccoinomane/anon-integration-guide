import { GetMarketDataResponse, MarketCompactData } from './client';
import { to$$$ } from './format';

/**
 * Format a market compact data object to a single line string,
 * with LP APY as main metric.
 */
export function formatMarketCompactDataWithLiquidityApy(market: MarketCompactData): string {
    let parts = [];
    parts.push(`Pool ${market.name}`);
    parts.push(` expiring on ${market.expiry}:`);
    parts.push(` from ${(market.details.aggregatedApy * 100).toFixed(2)}%`);
    parts.push(` to ${(market.details.maxBoostedApy * 100).toFixed(2)}% APY (max boost)`);
    parts.push(`, ${to$$$(market.details.liquidity, 0, 0)} liquidity`);
    return parts.join('');
}

/**
 * Format a market compact data object to a single line string,
 * with implied APY as main metric.
 */
export function formatMarketCompactDataWithImpliedApy(market: MarketCompactData): string {
    let parts = [];
    parts.push(`Market ${market.name}`);
    parts.push(` expiring on ${market.expiry}:`);
    parts.push(` yield ${(market.details.impliedApy * 100).toFixed(2)}% APY (implied)`);
    parts.push(`, ${to$$$(market.details.liquidity, 0, 0)} liquidity`);
    return parts.join('');
}

/**
 * Return a multiple line string with all data for the given market.
 */
export function formatMarketData(marketData: GetMarketDataResponse, market: MarketCompactData, includeTokensAddresses: boolean = false): string {
    let parts: string[] = [];
    parts.push(`Market ${market.name}:`);
    parts.push(` - Expires on: ${market.expiry}`);
    parts.push(` - Liquidity: ${to$$$(marketData.liquidity.usd, 0, 0)}`);
    parts.push(` - Total TVL: ${to$$$(marketData.totalTvl.usd, 0, 0)}`);
    parts.push(` - Trading volume: ${to$$$(marketData.tradingVolume.usd, 0, 0)}`);
    parts.push(` - Underlying asset price: ${to$$$(marketData.assetPriceUsd, 4, 4)}`);
    parts.push(` - Fixed yield PT earns you ${(marketData.impliedApy * 100).toFixed(2)}% fixed APY`);
    parts.push(` - The underlying asset earns an APY of ${(marketData.underlyingApy * 100).toFixed(2)}%`);
    parts.push(` - Providing liquidity earns you from ${(market.details.aggregatedApy * 100).toFixed(2)}% to ${(market.details.maxBoostedApy * 100).toFixed(2)}% APY (max boost)`);
    if (includeTokensAddresses) {
        parts.push(` - PT address: ${market.pt}`);
        parts.push(` - YT address: ${market.yt}`);
        parts.push(` - SY address: ${market.sy}`);
        parts.push(` - Underlying asset address: ${market.underlyingAsset}`);
    }
    return parts.join('\n');
}
