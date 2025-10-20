## Bug fixes

- APY from endpoint (https://d.pr/i/kcIny1) are slightly higher than APY on frontend (https://d.pr/i/i0LrWY). Maybe [copy formula from Google Sheet](https://discord.com/channels/820795644494610432/864157305566527508/880860136523059210)?

## Features

## Minor

- In `findConvexLpInfo` and `findConvexLvInfo`:
    - Add APR also to LV output
    - Add if there are claimable rewards (https://d.pr/i/IUQMoB)
- Improve `getMyPositionsPortfolio` output
- As of Oct 13 2025, cvxCRV is heavily depegged (see [here](https://www.defiwars.xyz/projects/convex) and [here](https://d.pr/i/gFtnBU)), should we disable the convert function?
- Drop Polygon and Arbitrum support (less than 1% of TVL combined)
- How to check CRV and CVX staking APR > https://discord.com/channels/820795644494610432/864157305566527508/1154349279763234868

## Future
