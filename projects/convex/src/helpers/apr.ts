/**
 * Calculate APR and APY for Convex LP and LV staking.
 * Uses the PoolUtilities contract to get actual on-chain reward rates
 * as shown on the Convex UI (Current vAPR > https://d.pr/i/V8QdM9)
 *
 * More details here:
 * - https://discord.com/channels/820795644494610432/864157305566527508/1428627572274630727
 * - https://docs.convexfinance.com/convexfinanceintegration/cvx-minting
 * - https://etherscan.io/address/0x5Fba69a794F395184b5760DAf1134028608e5Cd1#readContract
 */

import { PublicClient } from 'viem';
import { CRV_TOKEN_ADDRESS, CVX_TOKEN_ADDRESS, POOL_UTILITIES_CONTRACT_ADDRESS } from '../constants';
import { tokenHelper } from './tokenHelper';
import { poolUtilitiesAbi } from '../abis';

const SECONDS_PER_YEAR = 31_536_000n;

export interface AprBreakdown {
    // APRs from individual reward tokens, usually just CRV and CVX (in percentage, e.g., 5.2 means 5.2%)
    tokenAPRs: Record<`0x${string}`, number>;
    /** Total APR, given by the sum of all token APRs plus the base CRV APR (given as a percentage, e.g., 5.2 means 5.2%) */
    totalAPR: number;

    // Detailed breakdown of APRs from individual reward tokens
    breakdown: {
        /** Either CRV, CVX, or UNKNOWN (in which case you need to fetch the symbol from the token address) */
        tokenSymbol: string;
        /** Token address */
        tokenAddress: `0x${string}`;
        /** Reward rate per second per 1e18 staked LP */
        rate: bigint;
        /** APR in percentage, e.g., 5.2 means 5.2% */
        apr: number;
    }[];
}

interface ConvexAprParams {
    // Pool ID on Convex
    poolId: number;

    // Token prices in USD
    // Map of token address (lowercase) to price
    tokenPrices: Record<`0x${string}`, number>;

    // LP token price in USD
    lpTokenPrice: number;

    // Viem provider
    provider: PublicClient;
}

/**
 * Calculate APR using the PoolUtilities.apr() formula
 * apr = rate * 365 days * priceOfReward / priceOfDeposit
 *
 * @param rate Reward rate per second per 1e18 staked LP (from rewardRates)
 * @param priceOfReward USD price of reward token
 * @param priceOfDeposit USD price of LP token
 * @returns APR as a percentage (e.g., 5.2 for 5.2%)
 */
function calculateApr(rate: bigint, priceOfReward: number, priceOfDeposit: number): number {
    // Convert prices to wei (1e18 scale)
    const priceOfRewardWei = BigInt(Math.floor(priceOfReward * 1e18));
    const priceOfDepositWei = BigInt(Math.floor(priceOfDeposit * 1e18));

    // Formula from contract: rate * 365 days * priceOfReward / priceOfDeposit
    const aprWei = (rate * SECONDS_PER_YEAR * priceOfRewardWei) / priceOfDepositWei;

    // Convert to percentage (divide by 1e16 to get percentage with 2 decimals)
    return Number(aprWei) / 1e16;
}

/**
 * Calculate APR breakdown and total APY for Convex LP staking.
 * Uses the PoolUtilities contract to get actual on-chain reward rates.
 * DOES NOT include base APR (swap fees for pools, lending interest for vaults)
 */
export async function calculateConvexApr(params: ConvexAprParams, fetchTokensSymbols: boolean = false): Promise<AprBreakdown> {
    const { poolId, tokenPrices, lpTokenPrice, provider } = params;

    // 1. Call rewardRates() from the contract
    const [tokens, rates] = (await provider.readContract({
        address: POOL_UTILITIES_CONTRACT_ADDRESS,
        abi: poolUtilitiesAbi,
        functionName: 'rewardRates',
        args: [poolId],
    })) as [`0x${string}`[], bigint[]];

    // tokens: address[] - array of reward token addresses
    // rates: uint256[] - array of rates (per second per 1e18 staked LP)

    const breakdown: AprBreakdown['breakdown'] = [];
    const tokenAPRs: Record<`0x${string}`, number> = {};
    let totalAPR = 0;

    // 2. For each token/rate pair, calculate APR
    for (let i = 0; i < tokens.length; i++) {
        const tokenAddress = tokens[i].toLowerCase() as `0x${string}`;
        const rate = rates[i]; // Already a bigint in ethers v6 / viem

        // Get token price
        const tokenPrice = tokenPrices[tokenAddress];
        if (rate > 0n && !tokenPrice) {
            console.warn(`Could not compute APR from reward token ${tokenAddress}: token price not found`);
            continue;
        }

        // Skip if rate is 0 (no rewards)
        if (rate === 0n) {
            continue;
        }

        // Calculate APR using the contract's formula
        let apr = calculateApr(rate, tokenPrice, lpTokenPrice);

        // Determine token symbol
        let tokenSymbol: string;
        if (tokenAddress === CRV_TOKEN_ADDRESS.toLowerCase()) {
            tokenSymbol = 'CRV';
        } else if (tokenAddress === CVX_TOKEN_ADDRESS.toLowerCase()) {
            tokenSymbol = 'CVX';
        } else {
            if (fetchTokensSymbols) {
                tokenSymbol = await tokenHelper.getSymbol(provider, tokenAddress);
            } else {
                tokenSymbol = `TOKEN_${i}`;
            }
        }

        tokenAPRs[tokenAddress] = apr;
        totalAPR += apr;

        breakdown.push({
            tokenSymbol: tokenSymbol,
            tokenAddress: tokens[i],
            rate: rate,
            apr: apr,
        });
    }

    return {
        tokenAPRs,
        totalAPR,
        breakdown,
    };
}
