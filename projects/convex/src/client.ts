/**
 * Convex API client for the Curve protocol
 *
 * These endpoints are the same that are used by the Convex website.
 *
 * NB: If you want to implement the Frax protocol (which is different
 * than the Fraxtal chain), consider that it uses a different base URL
 * (frax.convexfinance.com) and had different return types for pools
 * and potentially other endpoints.
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import { CVX_TOKEN_ADDRESS } from './constants';
import { staticMemoize } from './helpers/memoize';

const BASE_URL = 'https://curve.convexfinance.com/api/';
const DEFAULT_TIMEOUT = 15000;

/*
  _____
 |_   _|  _   _   _ __     ___   ___
   | |   | | | | | '_ \   / _ \ / __|
   | |   | |_| | | |_) | |  __/ \__ \
   |_|    \__, | | .__/   \___| |___/
          |___/  |_|
*/

type Coin = {
    address: string;
    usdPrice: number;
    poolBalance: string;
    decimals: number | string;
    symbol: string;
    name: string;
    isBasePoolLpToken: boolean;
    blockchainId: string;
};

type PoolUrls = {
    swap: string[];
    deposit: string[];
    withdraw: string[];
};

type GaugeReward = {
    gaugeAddress: string;
    tokenPrice: number;
    name: string;
    symbol: string;
    decimals: string;
    apy: number;
    metaData?: {
        rate: string;
        periodFinish: number;
    };
    tokenAddress: string;
};

type HasMethods = {
    exchange_received: boolean;
    exchange_extended: boolean;
};

type GaugeStatus = {
    areCrvRewardsStuckInBridge: boolean;
    rewardsNeedNudging: boolean;
};

type ConvexPoolData = {
    id: number;
    token: `0x${string}`;
    gauge: `0x${string}`;
    crvRewards: `0x${string}`;
    stash: `0x${string}`;
    shutdown: boolean;
    usdTotal: number;
    rewards?: string;
};

type PointsData = {
    platform: string;
    dashboardLink: string;
    platformImageId: string;
    multiplier: number;
};

/**
 * A pool returned by the Convex API; this is basically info about a Curve
 * lending vault with the addition of the Convex-specific fields `convexPoolData`
 * and `pointsData`.
 */
export type Pool = {
    /** Alphanumeric ID */
    id: string;
    name: string;
    address: string;
    coinsAddresses: string[];
    decimals: string[];
    virtualPrice: string;
    amplificationCoefficient: string;
    totalSupply: string;
    assetType: string;
    lpTokenAddress: `0x${string}`;
    priceOracle?: number | null;
    symbol: string;
    implementation: string;
    assetTypeName: string;
    coins: Coin[];
    poolUrls: PoolUrls;
    usdTotal: number;
    isMetaPool: boolean;
    usdTotalExcludingBasePool: number;
    gaugeAddress: string | null;
    gaugeRewards: GaugeReward[];
    gaugeCrvApy: (number | null)[];
    usesRateOracle: boolean;
    isBroken: boolean;
    hasMethods: HasMethods;
    creationTs: number;
    creationBlockNumber: number;
    blockchainId: string;
    registryId: string;
    isGaugeKilled: boolean;
    isGaugeInController: boolean;
    gaugeWeight: string;
    gaugeRelativeWeight: string;
    convexPoolData: ConvexPoolData;
    pointsData: PointsData[];
    implementationAddress?: string;
    factory?: boolean;
    gaugeStatus?: GaugeStatus;
    gaugeFutureCrvApy?: (number | null)[];
    baseApy: number;
};

export type PoolsResponse = {
    pools: Pool[];
};

export type ApyResponse = {
    apys: ApyById;
};

/**
 * A map of LP token IDs to their APY data
 * (here the key is the Curve alphanumeric ID and not the Convex numeric ID)
 */
export type ApyById = {
    [key: string]: Apy;
};

export type Apy = {
    baseApy: number;
    crvApy: number;
    crvBoost: number;
    crvPrice: number;
    // cxvApy never on Ethereum, and it seems it's always 0
    cvxApy?: number;
    // extraRewards never on Ethereum
    extraRewards?: {
        name: string;
        symbol: string;
        coinAddress: `0x${string}`;
        tokenPrice: number;
        apy: number;
    }[];
};

export type ApyBreakdown = {
    [key: string]: number;
};

type LendingVaultRates = {
    borrowApr: number;
    borrowApy: number;
    borrowApyPcent: number;
    lendApr: number;
    lendApy: number;
    lendApyPcent: number;
};

type LendingVaultAsset = {
    symbol: string;
    decimals: number;
    address: string;
    blockchainId: string;
    usdPrice: number;
};

type LendingVaultShares = {
    pricePerShare: number;
    totalShares: number;
};

type LendingVaultTotals = {
    total: number;
    usdTotal: number;
};

type LendingVaultUrls = {
    deposit: string;
    withdraw: string;
    borrow: string;
};

type LendingVaultAmmBalances = {
    ammBalanceBorrowed: number;
    ammBalanceBorrowedUsd: number;
    ammBalanceCollateral: number;
    ammBalanceCollateralUsd: number;
};

/**
 * A lending vault returned by the Convex API; this is basically info about a Curve lending vault
 * with the addition of the Convex-specific fields `convexPoolData` and `pointsData`.
 */
export type LendingVault = {
    id: string;
    name: string;
    address: `0x${string}`;
    controllerAddress: string;
    ammAddress: string;
    monetaryPolicyAddress: string;
    rates: LendingVaultRates;
    gaugeAddress: string;
    gaugeRewards?: GaugeReward[];
    assets: {
        borrowed: LendingVaultAsset;
        collateral: LendingVaultAsset;
    };
    vaultShares: LendingVaultShares;
    totalSupplied: LendingVaultTotals;
    borrowed: LendingVaultTotals;
    availableToBorrow: LendingVaultTotals;
    lendingVaultUrls: LendingVaultUrls;
    usdTotal: number;
    ammBalances: LendingVaultAmmBalances;
    blockchainId: string;
    registryId: string;
    isGaugeKilled: boolean;
    gaugeWeight?: string;
    gaugeRelativeWeight?: string;
    gaugeCrvApy?: number[];
    gaugeFutureCrvApy?: number[];
    convexPoolData: ConvexPoolData;
    pointsData: PointsData[];
};

export type LendingVaultsResponse = {
    lendingVaults: LendingVault[];
};

/*
   ____   _   _                  _
  / ___| | | (_)   ___   _ __   | |_
 | |     | | | |  / _ \ | '_ \  | __|
 | |___  | | | | |  __/ | | | | | |_
  \____| |_| |_|  \___| |_| |_|  \__|

*/

/**
 * Convex Finance API client
 */
export class ConvexCurveClient {
    private client: AxiosInstance;

    /**
     * Create a new client
     *
     * @param timeout Request timeout in milliseconds (default: 15000)
     */
    constructor(timeout: number = DEFAULT_TIMEOUT) {
        this.client = axios.create({
            baseURL: BASE_URL,
            timeout,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });
    }

    /**
     * Handle API errors
     */
    private handleError(error: unknown): never {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            const dataMessage = (axiosError.response?.data as any)?.message as string;
            throw new ConvexApiError(axiosError.message + (dataMessage ? `. ${dataMessage}` : ''), axiosError.response?.status, axiosError.response?.data);
        }
        if (error instanceof Error) {
            throw new ConvexApiError(error.message);
        }
        throw new ConvexApiError('Unknown error occurred');
    }

    /**
     * Call the Convex API
     */
    async call<Data>(path: string, params: Record<string, any> = {}) {
        try {
            const response = await this.client.get<Data>(path, {
                params,
            });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Get info on all LP pools for a given chain
     */
    @staticMemoize()
    async pools(chainName: string): Promise<Pool[]> {
        let endpoint = '';
        switch (chainName.toLowerCase()) {
            case 'ethereum':
                endpoint = 'curve/pools';
                break;
            case 'arbitrum':
                endpoint = 'curve/pools-arbitrum';
                break;
            case 'polygon':
                endpoint = 'curve/pools-polygon';
                break;
            case 'fraxtal':
                endpoint = 'curve/pools-fraxtal';
                break;
            default:
                throw new Error(`Convex does not support chain named: ${chainName}`);
        }
        const response = await this.call<PoolsResponse>(`${endpoint}`);

        if (!response?.pools || !Array.isArray(response.pools)) {
            throw new ConvexApiError(`Malformed Convex response: missing or invalid 'pools' field`);
        }

        if (response.pools.length === 0) {
            throw new ConvexApiError(`Convex did not return any pools for chain named: ${chainName}`);
        }

        return response.pools;
    }

    /**
     * Get info on all lending vaults for a given chain
     * Please note that only Etherum and Fraxtal support lending vaults
     */
    @staticMemoize()
    async lendingVaults(chainName: string): Promise<LendingVault[]> {
        let endpoint = '';
        switch (chainName.toLowerCase()) {
            case 'ethereum':
                endpoint = 'curve/lending-vaults';
                break;
            case 'fraxtal':
                endpoint = 'curve/lending-vaults-fraxtal';
                break;
            default:
                throw new Error(`Convex does not support lending vaults for chain named: ${chainName}`);
        }
        const response = await this.call<LendingVaultsResponse>(`${endpoint}`);

        if (!response?.lendingVaults || !Array.isArray(response.lendingVaults)) {
            throw new ConvexApiError(`Malformed Convex response: missing or invalid 'lendingVaults' field`);
        }

        if (response.lendingVaults.length === 0) {
            throw new ConvexApiError(`Convex did not return any lending vaults for chain named: ${chainName}`);
        }

        return response.lendingVaults;
    }

    /**
     * Get all yield metrics for a given chain, including LPs
     * and lending vaults (crvUSD positions)
     */
    @staticMemoize()
    async apys(chainName: string): Promise<ApyById> {
        let endpoint = '';
        switch (chainName.toLowerCase()) {
            case 'ethereum':
                endpoint = 'curve-apys';
                break;
            case 'arbitrum':
                endpoint = 'curve-arbitrum-apys';
                break;
            case 'polygon':
                endpoint = 'curve-polygon-apys';
                break;
            case 'fraxtal':
                endpoint = 'curve-fraxtal-apys';
                break;
            default:
                throw new Error(`Convex does not support chain named: ${chainName}`);
        }
        const response = await this.call<ApyResponse>(`${endpoint}`);

        if (!response?.apys) {
            throw new ConvexApiError(`Malformed Convex response: missing 'apys' field`);
        }

        if (Object.keys(response.apys).length === 0) {
            throw new ConvexApiError(`Convex did not return any APY metrics for chain named: ${chainName}`);
        }

        return response.apys;
    }

    /**
     * Get the USD price of the CVX token, extracting it from the
     * (memoized) pools endpoint response, or zero if not found
     */
    @staticMemoize()
    async cvxPrice(chainName: string): Promise<number> {
        const pools = await this.pools(chainName);
        const cvxPools = pools.filter((pool) => pool.coins.some((coin) => coin.address.toLowerCase() === CVX_TOKEN_ADDRESS.toLowerCase()));
        if (cvxPools.length === 0) {
            return 0;
        }
        return cvxPools[0].coins.find((coin) => coin.address.toLowerCase() === CVX_TOKEN_ADDRESS.toLowerCase())?.usdPrice ?? 0;
    }
}

/**
 * Error class for Convex API errors
 */
export class ConvexApiError extends Error {
    public status?: number;
    public data?: any;

    constructor(message: string, status?: number, data?: any) {
        super(message);
        this.name = 'ConvexApiError';
        this.status = status;
        this.data = data;
    }
}
