import { AdapterExport, EVM } from '@heyanon/sdk';
import { MIN_TVL, N_MAX_RESULTS_IN_BEST_YIELD, N_MAX_RESULTS_IN_PORTFOLIO, supportedChains } from './constants';
import { to$$$ } from './helpers/format';

const { getChainName } = EVM.utils;

const DEPOSIT_TOOLS_ADDENDUM = [
    'The act of depositing the Curve tokens will result in the creation of the same amount of Convex tokens; these will be automatically staked in the rewards contract to earn CRV, CVX, and other rewards.',
    'Use getConvexLiquidityPool or getConvexLendingVault first to find the Convex ID of the pool/vault token.',
    'IMPORTANT: If multiple pools/vaults with the same name exist, and the user has tokens to deposit only in one of them, deposit into that one. If none of them or multiple of them have a balance, you MUST ask the user to specify which exact pool/vault they want to deposit into.',
].join('\n');

export const tools = [
    {
        type: 'function',
        function: {
            name: 'depositExactTokens',
            description: ['Deposit and stake a specific amount of Curve tokens (either LP tokens or Lending Vault tokens) into Convex.', DEPOSIT_TOOLS_ADDENDUM].join('\n'),
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(getChainName),
                        description: 'Chain name',
                    },
                    convexTokenId: {
                        type: 'number',
                        description: 'The numeric ID of the Convex pool or vault to deposit into',
                    },
                    amount: {
                        type: 'string',
                        description: 'The amount of Curve tokens to deposit, in decimal format (e.g., "1.5" for 1.5 tokens)',
                    },
                },
                required: ['chainName', 'convexTokenId', 'amount'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'depositDollarAmount',
            description: [
                'Deposit and stake a specified USD value of Curve tokens (either LP tokens or Lending Vault tokens) into Convex.',
                'The function converts the dollar amount to the exact number of tokens based on current prices from the Curve API.',
                DEPOSIT_TOOLS_ADDENDUM,
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
                    convexTokenId: {
                        type: 'number',
                        description: 'The numeric ID of the Convex pool or vault to deposit into',
                    },
                    dollarAmount: {
                        type: 'number',
                        description: 'The USD value of tokens to deposit (e.g., 100 for $100 worth of tokens)',
                    },
                },
                required: ['chainName', 'convexTokenId', 'dollarAmount'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'depositFractionOfTokens',
            description: ["Deposit and stake a percentage of the user's Curve tokens (either LP tokens or Lending Vault tokens) into Convex.", DEPOSIT_TOOLS_ADDENDUM].join('\n'),
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(getChainName),
                        description: 'Chain name',
                    },
                    convexTokenId: {
                        type: 'number',
                        description: 'The numeric ID of the Convex pool or vault to deposit into',
                    },
                    percentage: {
                        type: 'number',
                        description: "The percentage of user's Curve tokens to deposit (0-100, e.g., 50 for 50%, 100 for all tokens)",
                    },
                },
                required: ['chainName', 'convexTokenId', 'percentage'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'withdraw',
            description: [
                "Withdraw a percentage of the user's deposited tokens from Convex, thus converting them back to the underlying Curve tokens.",
                "Use the `getMyPositionsPortfolio` tool to check the user's overall positions before withdrawing any tokens.",
                'If more than one pool/vault with the same name exists, and only one of them has a balance, withdraw from that one. If none of them or multiple of them have a balance, you MUST ask the user to specify which exact pool/vault they want to withdraw from.',
            ].join('\n'),
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(EVM.utils.getChainName),
                        description: 'Chain name',
                    },
                    convexTokenId: {
                        type: 'number',
                        description: 'The numeric ID of the Convex pool or vault to withdraw from',
                    },
                    removalPercentage: {
                        type: ['number', 'null'],
                        description: 'Percent of liquidity to remove, expressed as a number (e.g. 50 for 50%). If null, all of the user liquidity will be removed.',
                    },
                    withdrawUnstaked: {
                        type: ['boolean', 'null'],
                        description: 'Whether to withdraw unstaked tokens.  Default is false, which means that only staked tokens will be withdrawn.',
                    },
                },
                required: ['chainName', 'convexTokenId', 'removalPercentage', 'withdrawUnstaked'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getMyPositionsPortfolio',
            description: [
                [
                    `Show the top ${N_MAX_RESULTS_IN_PORTFOLIO} positions in the user's portfolio on the given chain: Convex Liquidity Pools (LP) tokens and Convex Lending Vaults (LV) tokens.`,
                    `Importantly, this tool will also include any Curve token that the user has in their wallet but has not yet deposited on Convex.`,
                    `For each position, shows the token balance, dollar value and yield (APR).`,
                    `The total portfolio value (TVL) across all positions is also shown.`,
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
            name: 'getBestYieldOpportunitiesForUnderlyingToken',
            description: [
                `Show the top ${N_MAX_RESULTS_IN_BEST_YIELD} yield opportunities for the given underlying token on Convex, sorted by APR yield.`,
                `The result will include both Convex Liquidity Pools (LP) and Convex Lending Vaults (LV).`,
                `For each opportunity, also shows whether the user has any Curve tokens in their wallet that they could deposit on Convex.`,
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
            name: 'getConvexLiquidityPool',
            description: [
                [
                    'Find information about a specific LP token on Convex, searching by either its numeric ID or its UI name (as shown on the Convex website).',
                    'The result will include: the balance of the user in the Convex LP token, a breakdown of the earned APR yield, and the underlying Curve tokens that the user can deposit on Convex to earn rewards.',
                    'ALWAYS use this function to find the ID of a Convex LP token.',
                ].join('\n'),
            ].join('\n'),
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
            name: 'getConvexLendingVault',
            description: [
                'Find information about a specific Lending Vault (LV) token on Convex, searching by either its numeric ID or its UI name (as shown on the Convex website).',
                'The result will include: the balance of the user in the Convex LV token, a breakdown of the earned APR yield, and the underlying Curve tokens that the user can deposit on Convex to earn rewards.',
                'ALWAYS use this function to find the ID of a Convex LV token.',
            ].join('\n'),
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
