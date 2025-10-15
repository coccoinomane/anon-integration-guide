import { AdapterExport, EVM } from '@heyanon/sdk';
import { CONVEX_POSITION_TYPES, MAX_POSITIONS_IN_RESULTS, supportedChains } from './constants';

const { getChainName } = EVM.utils;

export const tools = [
    {
        type: 'function',
        function: {
            name: 'getMyPositionsPortfolio',
            description: [
                [
                    `Show the top ${MAX_POSITIONS_IN_RESULTS} positions in the user's portfolio on the given chain, including:`,
                    `- staked LP tokens;`,
                    `- staked lending vault tokens;`,
                    `- staked crvCVX tokens;`,
                    `- staked and locked CVX tokens.`,
                    `For each position, the token balance and dollar value are shown.`,
                    `The total portfolio value (TVL) acrosso all positions is also shown.`,
                    `Optionally, select which types of positions to show using the 'positionTypes' parameter; default is all positions.`,
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
                        description: 'List of position types to include in the result. By default, all positions are included',
                        items: {
                            type: 'string',
                            enum: CONVEX_POSITION_TYPES,
                        },
                    },
                },
                required: ['chainName', 'positionTypes'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'findConvexLpInfo',
            description:
                'Find information about a specific Convex LP token, searching by either its numeric ID or its UI name (as shown on the Convex website). ALWAYS use this function to find the ID of a Convex LP token. The result will include info on any user positions in the Convex LP token.',
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
                'Find information about a specific Convex Lending Vault (LV) token, searching by either its numeric ID or its UI name (as shown on the Convex website). ALWAYS use this function to find the ID of a Convex LV token. The result will include info on any user positions in the Convex LV token.',
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
                            'A string with either the numeric ID or the name of the Convex Lending Vault (LV) token to get information about.  The name of a Convex LV token (as shown on the Convex website) consists of the symbol of the token used as collateral, for example "sUSDe", "WETH" or "WBTC".  The match is case-insensitive.',
                        ].join('\n'),
                    },
                },
                required: ['chainName', 'convexLvIdOrName'],
                additionalProperties: false,
            },
        },
    },
] satisfies AdapterExport['tools'];
