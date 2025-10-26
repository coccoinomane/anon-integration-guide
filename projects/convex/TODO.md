## Bug fixes

- APY from endpoint (https://d.pr/i/kcIny1) are slightly higher than APY on frontend (https://d.pr/i/i0LrWY). Maybe [copy formula from Google Sheet](https://discord.com/channels/820795644494610432/864157305566527508/880860136523059210)?

## Features

## Minor

- Check that extra rewards are displayed correctly
- Warning for cvxCRV depegging (see [here](https://www.defiwars.xyz/projects/convex) and [here](https://d.pr/i/gFtnBU))
- How to check CRV and CVX staking APR > https://discord.com/channels/820795644494610432/864157305566527508/1154349279763234868

## Future

- In deposit tools, if the user does not have enough tokens, we could suggest him to deposit into Curve first by showing them the URL to the Curve pool/lending vault page
- In `getConvexLiquidityPool` and `getConvexLendingVault`, specify the amounts of claimable rewards (https://d.pr/i/IUQMoB)
- Should we allow the user to stake already deposited tokens? E.g. by adding a "stakeUnstakedTokens" parameter to deposit tools?
- The assistant always sets minTvl to zero in portfolio tool, should we enforce the minimum value?
