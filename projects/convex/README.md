# Convex Finance Yield Maximization

Convex Finance allows you to maximize yield from [Curve Finance](https://curve.fi/), [Frax Finance](https://frax.com/) and other Decentralized Finance platforms.

This integration only supports Curve Finance, which as of Oct 2025 represents more than 90% of Convex total TVL. The main features supported by this integration are:

- [Stake your Curve positions](https://curve.convexfinance.com/stake), be it a liquidity position or a Lending Vault crvUSD token, to earn max-boosted rewards
- [Convert your Curve tokens](https://curve.convexfinance.com/stake) (CRV) to cvxCRV, a liquid token that, once staked, accrues Curve platform revenue without the need to lock your CRV
- [Stake your Convex tokens](https://curve.convexfinance.com/stake#stake-cvx) (CVX) to earn Convex platform revenue
- [Stake & lock your Convex tokens](https://www.convexfinance.com/lock-cvx) to earn extra revenue from voting incentives, via the [Votium app](https://votium.app/), on top of Convex platform revenue

More information on Convex Finance can be found on their own academy page: https://www.convexfinance.com/academy

## Worth noting

- Computing accurate APYs was the trickiest part, as I had to do some on-chain computation; for more details see:
    - https://discord.com/channels/820795644494610432/864157305566527508/1428627572274630727
    - https://docs.convexfinance.com/convexfinanceintegration/cvx-minting
    - https://etherscan.io/address/0x5Fba69a794F395184b5760DAf1134028608e5Cd1#readContract
    - https://discord.com/channels/820795644494610432/864157305566527508/880860136523059210

- The Convex integration supports only Ethereum, where 96% of the protocol TVL is concentrated, and the only chain where you can stake CVX tokens

- As of Oct 13 2025, cvxCRV is heavily depegged (see [here](https://www.defiwars.xyz/projects/convex) and [here](https://d.pr/i/gFtnBU)), should we disable the convert function?

## Examples of commands

### Portfolio dashboard

    - Show all my positions on Ethereum on Convex
    - Show my LP positions on Ethereum on Convex
    - My total TVL on Ethereum on Arbitrum on Convex
    - Value of my CRV+cvxCRV position on Ethereum on Convex?
    - Value of my WETH lending vault on Ethereum on Convex?
    - TODO: How much CRV I have staked on Convex?
    - TODO: Value of my locked CVX position on Convex

### Yield opportunities

    - TODO: Surface best opportunities on Convex on Ethereum based on my portfolio
    - TODO: Best yields on Convex on Ethereum?
    - Show me the APY of the Convex FRAX+USDe pool on Ethereum on Convex
    - Show me the all the details of the eUSD lending vault on Ethereum
    - TODO: Give me APY of Convex CRV staking on Ethereum
    - TODO: Show Convex pools with highest APY on Ethereum

### Deposit & withdraw

    - TODO: Convert and stake my CRV on Convex
    - TODO: Stake my Curve USDC-USDT liquidity on Convex
    - TODO: Stake my Curve sreUSD lending position on Convex
    - TODO: Stake and lock 100 CVX on Convex

## Claim rewards

    - TODO: Show my claimable rewards on Convex
    - TODO: Claim all of my available rewards on Convex
    - TODO: Claim my LP rewards on Convex

## Test with the local agent

I've built a simple agent called `ask-convex` to test the integration. To run it, you need to configure .env:

```bash
cd projects/convex
pnpm install
cp .env.example .env
# insert test wallet private key into .env
# insert OpenAI or DeepSeek key into .env
```

and then you can ask questions directly:

```bash
pnpm ask-convex "What can I do on Convex?"
pnpm ask-convex "Stake my USDC-USDT liquidity on Curve LP on Convex"
```

Options:

- `--debug-llm`: Show the actual LLM responses
- `--debug-tools`: Show the output of every tool call

## Useful links

- [Curve Staking page](https://curve.convexfinance.com/stake)
- [Curve Claim page](https://curve.convexfinance.com/claim)
- [Lock CVX page](https://www.convexfinance.com/lock-cvx)
- [Votium app for bribes/incentives](https://votium.app/)

## Transactions

- [Deposit and stake LP](https://etherscan.io/tx/0x6daf22d6cae0029d483f87619a0a75777162a7dc15a01f38d41960f748aa213a)
- [Unstake and withdraw LP](https://etherscan.io/tx/0xc17f5a231c1afc73407576364bdc14281c87843ddb0f379b52f5b607facf1027)
- [Claim all rewards](https://etherscan.io/tx/0x976883b4e27d5646774ece1978668d7a94788751c8df5d3dcfe6c97d4753ece6)
- [Lock CVX](https://etherscan.io/tx/0xabb682980876276e4ebf9a60a15b4c19d96467b1d5e1a6903ebbc221f33740fa)
- [Stake crvUSD Lending Vault token](https://etherscan.io/tx/0xbc6d38aedf85ca04aeaf77929d1757ff9c28ee2ffec89e879b9fa68fd5e7b807)
