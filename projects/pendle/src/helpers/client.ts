/**
 * Pendle V2 SDK client
 */

import axios, { AxiosError, AxiosInstance } from 'axios';

const BASE_URL = 'https://api-v2.pendle.finance/core/';
const DEFAULT_TIMEOUT = 15000;

/*
  _____
 |_   _|  _   _   _ __     ___   ___
   | |   | | | | | '_ \   / _ \ / __|
   | |   | |_| | | |_) | |  __/ \__ \
   |_|    \__, | | .__/   \___| |___/
          |___/  |_|
*/

export type TokenAmountResponseWithChainId = {
    token: `${number}-0x${string}`;
    amount: string;
};

export type TokenAmountResponse = {
    token: `0x${string}`;
    amount: string;
};

export type ContractParamInfo = {
    method: string;
    contractCallParamsName: string[];
    contractCallParams: any[];
};

export type TransactionDto = {
    data: `0x${string}`;
    to: `0x${string}`;
    from: `0x${string}`;
    value?: string;
};

export type ConvertData = {
    priceImpact: number;
    impliedApy?: any;
    effectiveApy?: number;
    paramsBreakdown?: any;
};

export type RouteResponse = {
    contractParamInfo: ContractParamInfo;
    tx: TransactionDto;
    outputs: TokenAmountResponse[];
    data: ConvertData;
};

export type ConvertParams = {
    /** Chain ID number */
    chainId: number;
    /** The address to receive the output of the action */
    receiver: `0x${string}`;
    /** Max slippage accepted. A value from 0 to 1 (0.01 is 1%) */
    slippage: number;
    /** Enable swap aggregator to swap between tokens that cannot be natively converted from/to the underlying asset. Default value: false */
    enableAggregator?: boolean;
    /** List of aggregator names to use for the swap. If not provided, all aggregators will be used. List of supported aggregator can be found at: getSupportedAggregators */
    aggregators?: string;
    /** Input token addresses */
    tokensIn: `0x${string}`;
    /** Input token amounts */
    amountsIn: string;
    /** Output token addresses */
    tokensOut: `0x${string}`;
    /** Redeem rewards. Default value: false */
    redeemRewards?: boolean;
    /** Set needScale value for aggregators. When enabled, please make sure to buffer the amountIn by about 2%. Default value: false */
    needScale?: boolean;
    /** Available fields: impliedApy, effectiveApy. Comma separated list of fields to return. For example: field1,field2. More fields will consume more computing units. */
    additionalData?: string;
};

export type ConvertResponse = {
    action: string;
    inputs: TokenAmountResponse[];
    requiredApprovals?: TokenAmountResponse[];
    routes: RouteResponse[];
};

export type TokenPosition = {
    balance: string;
    activeBalance: string;
    valuation: number;
    claimTokenAmounts: TokenAmountResponseWithChainId[];
};

export type MarketPosition = {
    marketId: `${number}-0x${string}`;
    pt: TokenPosition;
    yt: TokenPosition;
    lp: TokenPosition;
};

export type SyPosition = {
    syId: `${number}-0x${string}`;
    balance: string;
    claimTokenAmounts: TokenAmountResponseWithChainId[];
};

export type ChainPositions = {
    chainId: number;
    totalOpen: number;
    totalClosed: number;
    totalSy: number;
    openPositions: MarketPosition[];
    closedPositions: MarketPosition[];
    syPositions: SyPosition[];
    updatedAt: string;
    errorMessage: string;
};

export type GetPositionsResponse = {
    positions: ChainPositions[];
};

export type YieldRange = {
    min: number;
    max: number;
};

export type MarketDetails = {
    liquidity: number;
    pendleApy: number;
    impliedApy: number;
    feeRate: number;
    yieldRange: YieldRange;
    aggregatedApy: number;
    maxBoostedApy: number;
};

export type MarketCompactData = {
    name: string;
    address: `0x${string}`;
    expiry: string;
    pt: `${number}-0x${string}`;
    yt: `${number}-0x${string}`;
    sy: `${number}-0x${string}`;
    underlyingAsset: `${number}-0x${string}`;
    details: MarketDetails;
    isNew: boolean;
    isPrime: boolean;
    timestamp: string;
    categoryIds: string[];
};

export type GetMarketsResponse = {
    markets: MarketCompactData[];
};

type UsdAndAcc = {
    usd: number;
    acc?: number;
};

type AssetPrice = {
    usd: number;
    acc: number;
};

type Asset = {
    id: string;
    chainId: number;
    address: string;
    symbol: string;
    decimals: number;
    expiry: string;
    accentColor: string;
    price: AssetPrice;
    priceUpdatedAt: string;
    name: string;
};

type EstimatedDailyPoolReward = {
    asset: Asset;
    amount: number;
};

export type GetMarketDataResponse = {
    timestamp: string;
    liquidity: UsdAndAcc;
    tradingVolume: UsdAndAcc;
    totalTvl: UsdAndAcc;
    underlyingInterestApy: number;
    underlyingRewardApy: number;
    underlyingApy: number;
    impliedApy: number;
    ytFloatingApy: number;
    swapFeeApy: number;
    voterApy: number;
    ptDiscount: number;
    pendleApy: number;
    arbApy: number;
    lpRewardApy: number;
    aggregatedApy: number;
    maxBoostedApy: number;
    estimatedDailyPoolRewards: EstimatedDailyPoolReward[];
    totalPt: number;
    totalSy: number;
    totalLp: number;
    totalActiveSupply: number;
    assetPriceUsd: number;
};

export type PendleAssetTag = 'PT' | 'YT' | 'SY' | 'PENDLE_LP';

export type PendleAsset = {
    /** Asset name (e.g., "PT FRAX-USDC") */
    name: string;
    /** Number of decimals for the token */
    decimals: number;
    /** Token contract address */
    address: `0x${string}`;
    /** Token symbol (e.g., "PT-FRAXUSDC_CurveLP_Convex-30MAR2023") */
    symbol: string;
    /** Asset tags indicating token type */
    tags: PendleAssetTag[];
    /** Expiry date for PT/YT tokens (ISO 8601 format) */
    expiry?: string;
    /** URL to the asset's icon */
    proicon?: string;
};

export type GetAssetsResponse = {
    assets: PendleAsset[];
};

export type RedeemInterestsAndRewardsParams = {
    chainId: number;
    receiver: `0x${string}`;
    /** list of SY addresses to check */
    sys?: `0x${string}`[];
    /** list of YT addresses to check */
    yts?: `0x${string}`[];
    /** list of market addresses to check (for LP rewards) */
    markets?: `0x${string}`[];
};

export type RedeemInterestsAndRewardsResponse = {
    method: string;
    contractCallParamsName: string[];
    contractCallParams: any[];
    tx: TransactionDto;
    tokenApprovals: TokenAmountResponse[];
};

export type ExitPositionsParams = {
    /** Chain ID number */
    chainId: number;
    /** Market address */
    market: `0x${string}`;
    /** The address to receive the output of the action */
    receiver: `0x${string}`;
    /** Max slippage accepted. A value from 0 to 1 (0.01 is 1%) */
    slippage: number;
    /** Output token address (can be token or SY) */
    tokenOut: `0x${string}`;
    /** Amount of PT tokens to exit */
    ptAmount: string;
    /** Amount of YT tokens to exit */
    ytAmount: string;
    /** Amount of LP tokens to exit */
    lpAmount: string;
    /** Enable swap aggregator to swap between tokens that cannot be natively converted from/to the underlying asset. Default value: false */
    enableAggregator?: boolean;
    /** List of aggregator names to use for the swap. If not provided, all aggregators will be used. List of supported aggregator can be found at: getSupportedAggregators */
    aggregators?: string;
};

export type ExitPositionsResponse = {
    method: string;
    contractCallParamsName: string[];
    contractCallParams: any[];
    tx: TransactionDto;
    tokenApprovals: TokenAmountResponse[];
    data: {
        amountOut: string;
        priceImpact: number;
    };
};

/*
   ____   _   _                  _
  / ___| | | (_)   ___   _ __   | |_
 | |     | | | |  / _ \ | '_ \  | __|
 | |___  | | | | |  __/ | | | | | |_
  \____| |_| |_|  \___| |_| |_|  \__|

*/

/**
 * Pendle Finance API client
 */
export class PendleClient {
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
            throw new PendleApiError(axiosError.message + (dataMessage ? `. ${dataMessage}` : ''), axiosError.response?.status, axiosError.response?.data);
        }
        if (error instanceof Error) {
            throw new PendleApiError(error.message);
        }
        throw new PendleApiError('Unknown error occurred');
    }

    /**
     * Call the Pendle API
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
     * Generate transaction call data for swaps, mint, add liquidity, etc
     */
    async convert(params: ConvertParams) {
        const response = await this.call<ConvertResponse>(`v2/sdk/${params.chainId}/convert`, params);

        return response;
    }

    /**
     * Generate transaction call data for claiming rewards and interests from YT and SY tokens
     */
    async redeemInterestsAndRewards(params: RedeemInterestsAndRewardsParams) {
        // Convert addresses to CSV format
        const formattedParams: Record<string, any> = {
            chainId: params.chainId,
            receiver: params.receiver,
        };
        if (params.sys) {
            formattedParams.sys = params.sys.join(',');
        }
        if (params.yts) {
            formattedParams.yts = params.yts.join(',');
        }
        if (params.markets) {
            formattedParams.markets = params.markets.join(',');
        }

        const response = await this.call<RedeemInterestsAndRewardsResponse>(`/v1/sdk/${params.chainId}/redeem-interests-and-rewards`, formattedParams);

        return response;
    }

    /**
     * Generate transaction call data for exiting LP, PT and YT positions in a market to token/SY
     */
    async exitPositions(params: ExitPositionsParams) {
        const { chainId, market, ...queryParams } = params;

        const response = await this.call<ExitPositionsResponse>(`v2/sdk/${chainId}/markets/${market}/exit-positions`, queryParams);

        return response;
    }

    /**
     * Get the positions across all chains for a given address
     */
    async getAddressPositions(user: `0x${string}`, params: Record<string, any> = {}): Promise<ChainPositions[]> {
        const response = await this.call<GetPositionsResponse>(`v1/dashboard/positions/database/${user}`, params);

        return response.positions;
    }

    /**
     * Get basic information for all active markets for a given chain
     */
    @staticMemoize()
    async getActiveMarkets(chainId: number) {
        const response = await this.call<GetMarketsResponse>(`v1/${chainId}/markets/active`);

        return response.markets;
    }

    /**
     * Get basic information for all inactive markets for a given chain
     */
    @staticMemoize()
    async getInactiveMarkets(chainId: number) {
        const response = await this.call<GetMarketsResponse>(`v1/${chainId}/markets/inactive`);

        return response.markets;
    }

    /**
     * Get the latest data for the given market on given chain, including
     * trading volume, asset prices, estimated rewards, etc
     */
    @staticMemoize()
    async getMarketData(chainId: number, marketAddress: string, params: Record<string, any> = {}): Promise<GetMarketDataResponse> {
        const response = await this.call<GetMarketDataResponse>(`v2/${chainId}/markets/${marketAddress}/data`, params);

        return response;
    }

    /**
     * Get all PT, YT, LP, and SY tokens with their metadata for a given chain
     */
    @staticMemoize()
    async getAllAssets(chainId: number): Promise<PendleAsset[]> {
        const response = await this.call<GetAssetsResponse>(`v3/${chainId}/assets/all`);

        return response.assets;
    }
}

// export function printConvertOutput(axiosResponse: AxiosResponse<ConvertResponse>) {
//     const resp = axiosResponse.data;
//     console.log('Action: ', resp.action);
//     console.log('Method: ', resp.routes[0].contractParamInfo.method);
//     console.log('Outputs: ', resp.routes[0].outputs);
//     console.log('Price impact: ', resp.routes[0].data.priceImpact);
//     console.log('Computing unit: ', axiosResponse.headers['x-computing-unit']);
//     console.log('\n--------------------------------\n');
// }

/**
 * A decorator for memoizing asynchronous methods.
 *
 * Potential pitfalls, not relevant for our use case:
 * 1. Pending Promise Race Condition: If the decorated method is called concurrently with the same arguments,
 *    the original function is not cached until it finishes executing, potentially triggering duplicate API calls.
 * 2. Shared Cache Across Instances: The cache is defined in the decorator closure and is shared across all instances,
 *    which can lead to unintended behavior if different instances (e.g. differing by baseUrl) should have separate
 *    cache entries.
 */
function staticMemoize(cacheKeyFn?: (...args: any[]) => string) {
    const cache = new Map<string, any>();

    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const key = cacheKeyFn ? cacheKeyFn(...args) : JSON.stringify(args);

            if (cache.has(key)) {
                return cache.get(key);
            }

            const result = await originalMethod.apply(this, args);
            cache.set(key, result);
            return result;
        };

        // Add static method to clear cache
        target.constructor[`clear${propertyKey}Cache`] = () => {
            cache.clear();
        };

        return descriptor;
    };
}

/**
 * Error class for Pendle API errors
 */
export class PendleApiError extends Error {
    public status?: number;
    public data?: any;

    constructor(message: string, status?: number, data?: any) {
        super(message);
        this.name = 'PendleApiError';
        this.status = status;
        this.data = data;
    }
}
