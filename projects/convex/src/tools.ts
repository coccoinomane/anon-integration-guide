import { AdapterExport, EVM } from '@heyanon/sdk';
import { MIN_TVL, N_MAX_RESULTS_IN_BEST_YIELD, N_MAX_RESULTS_IN_PORTFOLIO, supportedChains } from './constants';
import { to$$$ } from './helpers/format';

const { getChainName } = EVM.utils;

export const tools = [
    {
        type: 'function',
        function: {
            name: 'getMyPositionsPortfolio',
            description: [
                [
                    `Show the top ${N_MAX_RESULTS_IN_PORTFOLIO} positions in the user's portfolio on the given chain, including Convex Liquidity Pools (LP) tokens and Convex Lending Vaults (LV) tokens;`,
                    `For each position, shows the token balance, dollar value and yield (APR).`,
                    `The total portfolio value (TVL) across all positions is also shown.`,
                    `Optionally, select which types of positions to show using the 'positionTypes' parameter; default is all types (LP and LV).`,
                ].join('\n'),
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
                    positionTypes: {
                        type: ['array', 'null'],
                        description: 'List of position types to include in the result. By default, all types (LP and LV) are included',
                        items: {
                            type: 'string',
                            enum: ['LP', 'LV'],
                        },
                    },
                    minTvl: {
                        type: 'number',
                        description: `Minimum TVL in dollars for a Convex pool or vault to be shown in the result.  Default is ${to$$$(MIN_TVL, 0, 0)} dollars.  Setting this to 0 is very expensive request-wise, and should only be done if the user explicitly states that they want their positions regardless of TVL.`,
                    },
                },
                required: ['chainName', 'positionTypes', 'minTvl'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getBestYieldForToken',
            description: [
                `Show the top ${N_MAX_RESULTS_IN_BEST_YIELD} yield opportunities for the given underlying token on Convex, sorted by APR yield.`,
                `The result will include both Convex Liquidity Pools (LP) and Convex Lending Vaults (LV).`,
                `Will only include positions with a TVL of at least ${to$$$(MIN_TVL, 0, 0)} dollars.`,
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
                    tokenSymbol: {
                        type: 'string',
                        description: 'Symbol of the underlying token to search for, for example "CRV" or "CVX"',
                    },
                    positionTypes: {
                        type: ['array', 'null'],
                        description: 'List of position types to include in the result. By default, all types (LP and LV) are included',
                        items: {
                            type: 'string',
                            enum: ['LP', 'LV'],
                        },
                    },
                    // Contrary to the portfolio tool, here the user is
                    // not allowed to customize minTvl
                },
                required: ['chainName', 'tokenSymbol', 'positionTypes'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'findConvexLpInfo',
            description:
                'Find information about a specific Convex LP token, searching by either its numeric ID or its UI name (as shown on the Convex website). ALWAYS use this function to find the ID of a Convex LP token. The result will include info on any user positions in the Convex LP token, including a breakdown of the earned APR yield.',
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(EVM.utils.getChainName),
                        description: 'Chain name',
                    },
                    convexLpIdOrName: {
                        type: 'string',
                        description: [
                            'A string with either the numeric ID or the name of the Convex LP token to get information about.  The name of a Convex LP token (as shown on the Convex website) consists of the symbols of the pool coins delimited by the plus sign, for example "ETH+stETH", "USDC+USDT" or "crvUSD+tBTC+wstETH".  The match is case-insensitive.',
                        ].join('\n'),
                    },
                },
                required: ['chainName', 'convexLpIdOrName'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'findConvexLvInfo',
            description:
                'Find information about a specific Convex Lending Vault (LV) token, searching by either its numeric ID or its UI name (as shown on the Convex website). ALWAYS use this function to find the ID of a Convex LV token. The result will include info on any user positions in the Convex LV token, including a breakdown of the earned APR yield.',
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(EVM.utils.getChainName),
                        description: 'Chain name',
                    },
                    convexLvIdOrName: {
                        type: 'string',
                        description: [
                            'A string with either the numeric ID or the name of the Convex Lending Vault (LV) token to get information about.  The name of a Convex LV token (as shown on the Convex website) is just the symbol of the token used as collateral, for example "sUSDe", "WETH" or "WBTC".  The match is case-insensitive.',
                        ].join('\n'),
                    },
                },
                required: ['chainName', 'convexLvIdOrName'],
                additionalProperties: false,
            },
        },
    },
] satisfies AdapterExport['tools'];
