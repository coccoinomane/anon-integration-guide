import { FunctionOptions, FunctionReturn } from '@heyanon/sdk';
import { getConvexTokenToolHelper } from '../helpers/getConvexTokenToolHelper';

interface Props {
    chainName: string;
    convexLpIdOrName: string;
}

/**
 * Show the details of a Convex liquidity pool, including the ID,
 * APR, APY, and user balance.
 */
export async function getConvexLiquidityPool({ chainName, convexLpIdOrName }: Props, options: FunctionOptions): Promise<FunctionReturn> {
    return getConvexTokenToolHelper(chainName, convexLpIdOrName, 'LP', options);
}
