import { AdapterExport, EVM } from '@heyanon/sdk';
import {
    DEFAULT_SLIPPAGE_TOLERANCE,
    MAX_LIQUIDITY_POOLS_IN_RESULTS,
    MAX_MARKETS_IN_RESULTS,
    MAX_POSITIONS_IN_RESULTS,
    MIN_LIQUIDITY_FOR_MARKET,
    supportedChains,
} from './constants';

const { getChainName } = EVM.utils;

export const tools = [
    {
        type: 'function',
        function: {
            name: 'swapExactTokensIn',
            description: [
                'Swap the given amount of tokenIn with tokenOut. The tokens can be either:',
                '- Pendle-specific tokens (PT, YT, SY, LP): use getPendleTokenAddressFromTypeAndName to get their addresses',
                '- Regular tokens (ETH, USDC, USDT, wstETH, cbETH, etc.): use the normal token resolver to get their addresses',
                'Never try to guess token addresses: always use the appropriate function to resolve token symbols to addresses first.',
                'Please note that when both tokens are Pendle tokens, the swap is commonly called a "roll over".',
                'IMPORTANT: Pendle does not allow the following actions:',
                '- to swap directly between two regular tokens (in other words: at least one of the tokens must be a Pendle token)',
                '- to roll over directly from PT to YT and viceversa',
                "- to roll over directly from one market's YT to another market's YT",
                "- to roll over directly from one market's LP to another market's PT",
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
                    tokenInAddress: {
                        type: 'string',
                        description: 'Address of the token to be swapped in (e.g. "0x...")',
                    },
                    tokenInAmount: {
                        type: 'string',
                        description: 'The exact amount of tokens you want to swap in, expressed as decimals (e.g. 1 ETH rather than 10^18).  This number must be positive.',
                    },
                    tokenOutAddress: {
                        type: 'string',
                        description: 'Address of the token to be swapped out (e.g. "0x...").',
                    },
                    slippageTolerance: {
                        type: ['number', 'null'],
                        description: `Slippage tolerance, as a number from 0 to 1 (e.g. 0.01 for 1%). If not specified, the default of ${DEFAULT_SLIPPAGE_TOLERANCE} will be used.`,
                    },
                },
                required: ['chainName', 'tokenInAddress', 'tokenInAmount', 'tokenOutAddress', 'slippageTolerance'],
                additionalProperties: false,
            },
        },
    },
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
                        description: `Slippage tolerance, as a number from 0 to 1 (e.g. 0.01 for 1%). If not specified, the default of ${DEFAULT_SLIPPAGE_TOLERANCE} will be used.`,
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
                        description: `Slippage tolerance, as a number from 0 to 1 (e.g. 0.01 for 1%). If not specified, the default of ${DEFAULT_SLIPPAGE_TOLERANCE} will be used.`,
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
            name: 'claimRewardsAndInterests',
            description: [
                "Claim rewards for the given user's positions on the given chain. The positions are expressed as YT and LP token addresses.",
                'IMPORTANT: Before using this tool, always check whether the user has claimable rewards or interests using the showMyClaimableRewardsAndInterests tool.',
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
                    positionsAddresses: {
                        type: 'array',
                        description: "Array of YT and LP token addresses to claim rewards and interests for (e.g. ['0x...', '0x...'])",
                        items: {
                            type: 'string',
                        },
                    },
                },
                required: ['chainName', 'positionsAddresses'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getMyPositionsPortfolio',
            description: [
                `Show the top ${MAX_POSITIONS_IN_RESULTS} positions in the user's portfolio, across all chains, together with the total portfolio value (TVL).  A position can be a principal token (PT), a yield token (YT), standardized yield token (SY), or a liquidity pool (LP).  For each position, show its token balance and dollar value.`,
                `To show claimable rewards and interests, use the showMyClaimableRewardsAndInterests tool instead.`,
            ].join('\n'),
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
            name: 'showMyClaimableRewardsAndInterests',
            description: `Show all of the claimable rewards and interests in the user's positions on the given chain.  This consists of interests and rewards accrued by YT and LP positions.`,
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(getChainName),
                        description: 'Chain name',
                    },
                },
                required: ['chainName'],
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
                'Also included in the result are the addresses of the underlying token and of the Pendle tokens (PT, YT, SY, LP) associated with the market.',
                'IMPORTANT: The market address is not to be confused with the address of the Pendle tokens!  These are different addresses.',
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
                'Return the address of Pendle tokens on the given chain, based on their type and name. Only returns tokens with expiry in the future, unless an expiry date is specified.',
                'ONLY use this function when it is clear from context that the user is referring to Pendle-specific tokens: PT (Principal Token), YT (Yield Token), SY (Standardized Yield), or LP (Liquidity Pool) tokens.',
                'DO NOT use this function for regular tokens like ETH, USDC, USDT, wstETH, cbETH, etc.',
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
                    underlyingTokenName: {
                        type: 'string',
                        description:
                            'Name of the underlying token, for example: "wstETH", "sUSDe", "kHYPE". Occasionally has an optional specifier in parentheses, e.g. "wstETH (stETH)".',
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
                required: ['chainName', 'pendleTokenType', 'underlyingTokenName', 'shortExpiry'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getPendleTokenBalance',
            description: [
                'Fetch on-chain the balance of the user for the given Pendle token (PT, YT, SY, or LP); warns the user if not a Pendle token.  Use this tool as a faster alternative to the getMyPositionsPortfolio tool when the user is only interested in one or two of his Pendle tokens.  Also useful to determine whether the given token address is indeed a Pendle token.',
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
                    tokenAddress: {
                        type: 'string',
                        description: 'Token address (e.g. "0x...")',
                    },
                    account: {
                        type: ['string', 'null'],
                        description: "Optionally specify the address to check the balance for. Leave empty (default) to use the user's address.",
                    },
                },
                required: ['chainName', 'tokenAddress', 'account'],
                additionalProperties: false,
            },
        },
    },
] satisfies AdapterExport['tools'];
