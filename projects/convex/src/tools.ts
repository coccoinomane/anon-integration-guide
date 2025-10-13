import { AdapterExport } from '@heyanon/sdk';
import { MAX_POSITIONS_IN_RESULTS } from './constants';

export const tools = [
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
] satisfies AdapterExport['tools'];
