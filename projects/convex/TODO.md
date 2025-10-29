## Bug fixes

- APY from endpoint (https://d.pr/i/kcIny1) are slightly higher than APY on frontend (https://d.pr/i/i0LrWY). Maybe [copy formula from Google Sheet](https://discord.com/channels/820795644494610432/864157305566527508/880860136523059210)?

## Features

## Minor

## Future

- Optionally have the claimRewards tool to lock CVX (see ClaimZap.sol)
- Should we allow the user to stake already deposited tokens? E.g. by adding a "stakeUnstakedTokens" parameter to deposit tools?
- The assistant always sets minTvl to zero in portfolio tool, should we enforce the minimum value?
- Implement cvxCRV staking, CVX staking, CVX locking
- Implement CRV -> cvxCRV conversion, taking care of cvxCRV depegging (see [here](https://www.defiwars.xyz/projects/convex) and [here](https://d.pr/i/gFtnBU))
