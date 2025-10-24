import { AdapterExport, AdapterTag, Chain, EVM } from '@heyanon/sdk';
import { supportedChains } from './constants';
import * as functions from './functions';
import { tools } from './tools';

const { getChainName } = EVM.utils;

export default {
    tools,
    functions,
    description:
        'Convex Finance: maximize yield from Curve Finance, Frax Finance and other DeFi platforms. Stake Curve LP positions & vault tokens for max-boosted rewards. Convert CRV to cvxCRV for liquid staking. Stake or lock CVX to earn platform revenue and voting incentives. Portfolio: view positions, TVL, staked amounts. Markets: find pools with highest APY. Rewards: show and claim rewards.',
    tags: [AdapterTag.FARM],
    chains: supportedChains.map(getChainName) as Chain[],
    executableFunctions: [
        'depositExactTokens',
        'depositDollarAmount',
        'depositFractionOfTokens',
        'withdraw',
        'getMyPositionsPortfolio',
        'getBestYieldOpportunitiesForUnderlyingToken',
        'getConvexLiquidityPool',
        'getConvexLendingVault',
    ],
} satisfies AdapterExport;
