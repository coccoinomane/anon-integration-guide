import { AdapterExport, EVM } from '@heyanon/sdk';
import { supportedChains } from '../constants';

const { getChainName } = EVM.utils;

/**
 * Tools specific for the agent, and that are not
 * included in the HeyAnon integration because they could
 * interfer with HeyAnon's functionality.
 */
export const tools = [
    {
        type: 'function',
        function: {
            name: 'getTokenAddressFromSymbol',
            description: 'Get the address of a token from its symbol.',
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(getChainName),
                        description: 'Chain name',
                    },
                    symbol: {
                        type: 'string',
                        description: 'Token symbol (e.g. "wS", "stS", "USDC.e")',
                    },
                },
                required: ['chainName', 'symbol'],
                additionalProperties: false,
            },
            strict: true,
        },
    },
    {
        type: 'function',
        function: {
            name: 'getTokenBalance',
            description: 'Fetch on-chain the balance of the user for the given token',
            parameters: {
                type: 'object',
                properties: {
                    chainName: {
                        type: 'string',
                        enum: supportedChains.map(EVM.utils.getChainName),
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
