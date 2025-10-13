import { FunctionReturn, toResult } from '@heyanon/sdk';
import { CONVEX_POSITION_TYPES } from '../constants';

interface Props {
    chainName: string;
    positionTypes: typeof CONVEX_POSITION_TYPES;
}

export async function getMyPositionsPortfolio({ chainName, positionTypes }: Props): Promise<FunctionReturn> {
    positionTypes = positionTypes || CONVEX_POSITION_TYPES;
    return toResult({
        chainName,
        positionTypes,
    });
}
