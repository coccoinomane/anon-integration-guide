/**
 * Helper functions to interact with the Booster contract
 *
 * Docs: https://docs.convexfinance.com/convexfinanceintegration/booster
 */

import { PublicClient } from 'viem';
import { CONVEX_BOOSTER_CONTRACT_ADDRESS } from '../constants';
import { boosterAbi } from '../abis';

/**
 * Pool info returned by the poolInfo() method on the Booster contract,
 * applies to both pools and vaults (they are the same at the smart
 * contract level).
 */
export type BoosterPoolInfo = {
    lptoken: `0x${string}`;
    token: `0x${string}`;
    gauge: `0x${string}`;
    crvRewards: `0x${string}`;
    stash: `0x${string}`;
    shutdown: boolean;
};

/**
 * Fetch pool info from Booster contract
 */
export async function fetchBoosterPoolInfo(provider: PublicClient, convexTokenId: number): Promise<BoosterPoolInfo> {
    const result = (await provider.readContract({
        address: CONVEX_BOOSTER_CONTRACT_ADDRESS,
        abi: boosterAbi,
        functionName: 'poolInfo',
        args: [BigInt(convexTokenId)],
    })) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, boolean];

    return {
        lptoken: result[0],
        token: result[1],
        gauge: result[2],
        crvRewards: result[3],
        stash: result[4],
        shutdown: result[5],
    };
}
