// Balance and positions
export { getBalance } from './getBalance';
export { getPositions } from './getPositions';
export { getPositionOnMarket } from './getPositionOnMarket';

// Market information
export { getCurrencyMarketsOfGivenType } from './getCurrencyMarketsOfGivenType';
export { getMarketInfo } from './getMarketInfo';

// Order management
export { getOpenOrders } from './getOpenOrders';
export { getOrderById } from './getOrderById';
export { cancelOrder } from './cancelOrder';
export { cancelAllOrders } from './cancelAllOrders';

// Trading - Orders
export { createSimpleOrder } from './createSimpleOrder';
export { createTriggerOrder } from './createTriggerOrder';
export { createTrailingStopOrder } from './createTrailingStopOrder';
export { createOcoOrder } from './createOcoOrder';

// Position management
export { closePosition } from './closePosition';
export { closeAllPositions } from './closeAllPositions';

// Leverage and margin
export { setMarketLeverage } from './setMarketLeverage';
export { setMarginMode } from './setMarginMode';

// TODO: Future implementations
// export { createTrailingStopOrder } from './createTrailingStopOrder';
// export { addMarginToIsolatedPosition } from './addMarginToIsolatedPosition';
// export { reduceMarginFromIsolatedPosition } from './reduceMarginFromIsolatedPosition';
