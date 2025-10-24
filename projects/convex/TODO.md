## Bug fixes

- APY from endpoint (https://d.pr/i/kcIny1) are slightly higher than APY on frontend (https://d.pr/i/i0LrWY). Maybe [copy formula from Google Sheet](https://discord.com/channels/820795644494610432/864157305566527508/880860136523059210)?

## Features

## Minor

- Deposit should work also with deposited tokens, not just deposited+staked tokens
- In deposit tools, show URL to Curve pool/lending vault if not enough tokens?
- In `getConvexLiquidityPool` and `getConvexLendingVault`, specify if there are claimable rewards (https://d.pr/i/IUQMoB)
- In `getConvexLiquidityPool`, fix the issue whereby "cvxCRV-CRV" and "cvxCRV+CRV" are not found. Could be solved by searching by coins ([coin1, coin2, ...]) instead of UI name.
- Warning for cvxCRV depegging (see [here](https://www.defiwars.xyz/projects/convex) and [here](https://d.pr/i/gFtnBU))
- How to check CRV and CVX staking APR > https://discord.com/channels/820795644494610432/864157305566527508/1154349279763234868
- Add docstrings to functions

## Future
