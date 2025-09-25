import { AdapterExport, EVM } from '@heyanon/sdk';
import { MAX_LIQUIDITY_POOLS_IN_RESULTS, MAX_MARKETS_IN_RESULTS, MAX_POSITIONS_IN_RESULTS, MIN_LIQUIDITY_FOR_MARKET, supportedChains } from './constants';

const { getChainName } = EVM.utils;

export const tools = [
    {
        type: 'function',
        function: {
            name: 'addLiquidityToMarketPool',
            description: `Add liquidity to a liquidity pool on the given market on the given chain.  The liquidity must be provided by a single token, which will be zapped in to the pool.`,
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
                        type: 'string',
                        description: 'Address of the token to be zapped in (e.g. "0x...")',
                    },
                    tokenInAmount: {
                        type: 'number',
                        description: 'Amount of liquidity to add in terms of the input token, expressed in human readable format (e.g. 1000 for 1000 tokens)',
                    },
                    slippageTolerance: {
                        type: ['number', 'null'],
                        description:
                            'Slippage tolerance, as a number from 0 to 1 (e.g. 0.01 for 1%).  This is needed because the provided token will be swapped to PT and SY tokens before being added to the pool.',
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
            name: 'getMyPositionsPortfolio',
            description: `Show the top ${MAX_POSITIONS_IN_RESULTS} positions in the user's portfolio, across all chains, together with the total portfolio value (TVL).  A position can be a principal token (PT), a yield token (YT) or a liquidity pool (LP).  For each position, show its token balance and dollar value.`,
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
            name: 'getAddressPositionsPortfolio',
            description: `Show the top ${MAX_POSITIONS_IN_RESULTS} positions in the portfolio of the given wallet address, across all chains, together with the total portfolio value (TVL). A position can be a principal token (PT), a yield token (YT) or a liquidity pool (LP).  For each position, show its token balance and dollar value.`,
            strict: true,
            parameters: {
                type: 'object',
                properties: {
                    address: {
                        type: 'string',
                        description: 'Wallet address for which to show the portfolio',
                    },
                },
                required: ['address'],
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
            description: `Get the info and latest data for the given market on given chain, including yields, TVL, liquidity, trading volume, asset prices, estimated rewards, etc.`,
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
            description: `Search for active markets with names matching the given string, on the given chain.  Returns minimal information including the name, address and expiry date of the markets.  Useful to get the address of a market to use in the getDataOnMarket function.`,
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
] satisfies AdapterExport['tools'];
