import { FunctionOptions, FunctionReturn } from '@heyanon/sdk';
import { getConvexTokenToolHelper } from '../helpers/getConvexTokenToolHelper';

interface Props {
    chainName: string;
    convexLvIdOrName: string;
}

/**
 * Show the details of a Convex lending vault, including the ID,
 * APR, APY, and user balance.
 */
export async function getConvexLendingVault({ chainName, convexLvIdOrName }: Props, options: FunctionOptions): Promise<FunctionReturn> {
    return getConvexTokenToolHelper(chainName, convexLvIdOrName, 'LV', options);
}
