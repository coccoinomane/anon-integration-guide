import { AdapterExport, EVM } from '@heyanon/sdk';
import { MAX_LIQUIDITY_POOLS_IN_RESULTS, MAX_MARKETS_IN_RESULTS, MAX_POSITIONS_IN_RESULTS, MIN_LIQUIDITY_FOR_MARKET, supportedChains } from './constants';

const { getChainName } = EVM.utils;

export const tools = [
    {
        type: 'function',
        function: {
            name: 'addLiquidityToMarketPool',
            description: `Add liquidity to the liquidity pool of the given market on the given chain.  The liquidity must be provided via a single token; if the token is different from the underlying asset of the pool, it will be zapped in to the pool.`,
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(getChainName),
                        description: 'Chain name',
                    },
                    marketAddress: {
                        type: 'string',
                        description: 'Market address (e.g. "0x...")',
                    },
                    tokenInAddress: {
                        type: ['string', 'null'],
                        description: 'Address of the token to be used to add liquidity (e.g. "0x...").  If null, the underlying asset of the pool will be used.',
                    },
                    tokenInAmount: {
                        type: 'string',
                        description: 'Amount of liquidity to add in terms of the input token, expressed as decimals (e.g. 1 ETH rather than 10^18)',
                    },
                    slippageTolerance: {
                        type: ['number', 'null'],
                        description: 'Slippage tolerance, as a number from 0 to 1 (e.g. 0.01 for 1%).  Used only when zapping in.',
                    },
                },
                required: ['chainName', 'marketAddress', 'tokenInAddress', 'tokenInAmount', 'slippageTolerance'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'removeLiquidityFromMarketPool',
            description: `Remove a percentage of the user's deposited liquidity from the pool of the given market.  Optionally, convert (zap) it to a custom output token.  Omit the removal percentage to remove all of the user's liquidity from the pool.`,
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(getChainName),
                        description: 'Chain name',
                    },
                    marketAddress: {
                        type: 'string',
                        description: 'Market address (e.g. "0x...")',
                    },
                    tokenOutAddress: {
                        type: ['string', 'null'],
                        description: 'Address of the token to be converted to (e.g. "0x...").  If null, the user will receive the underlying token of the pool.',
                    },
                    removalPercentage: {
                        type: ['number', 'null'],
                        description: 'Percent of liquidity to remove, as a number from 0 to 1 (e.g. 0.01 for 1%). If null, all of the user liquidity will be removed.',
                    },
                    slippageTolerance: {
                        type: ['number', 'null'],
                        description:
                            "Slippage tolerance, as a number from 0 to 1 (e.g. 0.01 for 1%).  This is needed because the user's liquidity will be converted to the output token.",
                    },
                    redeemRewards: {
                        type: ['boolean', 'null'],
                        description: 'Whether to redeem rewards along with the liquidity. Default is true.',
                    },
                },
                required: ['chainName', 'marketAddress', 'tokenOutAddress', 'removalPercentage', 'slippageTolerance', 'redeemRewards'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getMyPositionsPortfolio',
            description: `Show the top ${MAX_POSITIONS_IN_RESULTS} positions in the user's portfolio, across all chains, together with the total portfolio value (TVL).  A position can be a principal token (PT), a yield token (YT), standardized yield token (SY), or a liquidity pool (LP).  For each position, show its token balance and dollar value.`,
            strict: true,
            parameters: {
                type: 'object',
                properties: {},
                required: [],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getMarketsWithHighestApy',
            description: `Show the top ${MAX_MARKETS_IN_RESULTS} markets with the highest yield.  Yield here is measured by the implied APY metric, which corresponds to the fixed annualized yield accrued by 1 PT token for the given market. For each market, show its name, expiry, TVL, and yield. For safety reasons only markets with a minimum liquidity of $${MIN_LIQUIDITY_FOR_MARKET} are shown.`,
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(getChainName),
                        description: 'Chain name',
                    },
                    filterTokenSymbol: {
                        type: ['string', 'null'],
                        description: 'Optionally, filter the markets by name (e.g. "ETH", "stETH", "USDC")',
                    },
                },
                required: ['chainName', 'filterTokenSymbol'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getLiquidityPoolsWithHighestApy',
            description: `Show the top ${MAX_LIQUIDITY_POOLS_IN_RESULTS} liquidity pools with the highest yield, on the given chain. For each liquidity pool, show its name, expiry, TVL, and yield. For safety reasons only pools with a minimum liquidity of $${MIN_LIQUIDITY_FOR_MARKET} are shown.`,
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(getChainName),
                        description: 'Chain name',
                    },
                    filterTokenSymbol: {
                        type: ['string', 'null'],
                        description: 'Optionally, filter the pools by name (e.g. "ETH", "stETH", "USDC")',
                    },
                },
                required: ['chainName', 'filterTokenSymbol'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getDataOnMarket',
            description: [
                'Get info and latest data for the given market on given chain, including yields, TVL, liquidity, trading volume, asset prices, estimated rewards, etc.',
                'Also include the addresses of PT, YT, SY, LP and underlying tokens for the market.',
            ].join('\n'),
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(getChainName),
                        description: 'Chain name',
                    },
                    marketAddress: {
                        type: ['string', 'null'],
                        description: 'Market address (e.g. "0x...")',
                    },
                },
                required: ['chainName', 'marketAddress'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'searchMarketsByName',
            description: 'Search for active markets with names matching the given string.  Returns minimal information including the name, address and expiry date of the markets.',
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(getChainName),
                        description: 'Chain name',
                    },
                    searchString: {
                        type: 'string',
                        description: 'String to search for in the market names',
                    },
                },
                required: ['chainName', 'searchString'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getPendleTokenAddressFromTypeAndName',
            description: [
                'Given the type and name of a Pendle token, return the address of that token on the given chain.  Only returns tokens with expiry in the future, unless an expiry date is specified.',
                'Useful to find the actual addresses of Pendle tokens for the swap tools.',
                'If this tool fails resolving a Pendle token, try with the `searchMarketsByName` tool, in case the user specified the market name rather than the token name.',
            ].join('\n'),
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(getChainName),
                        description: 'Chain name',
                    },
                    pendleTokenType: {
                        type: 'string',
                        description:
                            'Type of the token.  Can be "PT" for principal token, "YT" for yield token, "SY" for standardized yield token or "LP" for liquidity pool token',
                        enum: ['PT', 'YT', 'SY', 'LP'],
                    },
                    pendleTokenName: {
                        type: 'string',
                        description:
                            'Name of the Pendle token.  Formed by the underlying token optionally followed by the maturation token in parentheses.  These, for example, are all valid names: "wstETH", "sUSDe", "kHYPE","wstETH (stETH)", "sUSDe (USDe)", "kHYPE (Hype)", etc.',
                    },
                    shortExpiry: {
                        type: ['string', 'null'],
                        description: [
                            'Optional expiry date of the token, in short format. If not provided, the function will only consider non-expired tokens.',
                            'Expiry date should be provided in the following format:',
                            ' - Day first (30) (optional)',
                            ' - Then Three-letter month abbreviation (MAR) (optional)',
                            ' - Then Four-digit year (2026)',
                            'For example:',
                            ' - "30MAR2026" for expiration on March 30, 2026',
                            ' - "12DEC2025" for expiration on December 12, 2025',
                            ' - "MAR2027" for expiration during the month of March of the year 2027',
                            ' - "2026" for expiration during the year 2026',
                        ].join('\n'),
                    },
                },
                required: ['chainName', 'pendleTokenType', 'pendleTokenName', 'shortExpiry'],
                additionalProperties: false,
            },
        },
    },
] satisfies AdapterExport['tools'];
