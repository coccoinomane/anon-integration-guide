import { MarketCompactData } from './client';
import { to$$$ } from './format';

/**
 * Format a market compact data object to a single line string.
 */
export function formatMarketCompactData(market: MarketCompactData): string {
    let parts = [];
    parts.push(`Pool ${market.name}:`);
    parts.push(` from ${(market.details.aggregatedApy * 100).toFixed(2)}%`);
    parts.push(` to ${(market.details.maxBoostedApy * 100).toFixed(2)}% APY (max boost)`);
    parts.push(` ${to$$$(market.details.liquidity, 0, 0)} liquidity`);
    return parts.join('');
}
