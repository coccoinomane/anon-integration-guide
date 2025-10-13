# Convex Finance Yield Maximization

Convex Finance allows you to maximize yield from [Curve Finance](https://curve.fi/), [Frax Finance](https://frax.com/) and other Decentralized Finance platforms. The main features of Convex are:

- [Stake your Curve positions](https://curve.convexfinance.com/stake), be it a liquidity position or a Lending vault token, to earn max-boosted rewards
- [Convert your Curve tokens](https://curve.convexfinance.com/stake) (CRV) to cvxCRV, a liquid token that, once staked, accrues Curve platform revenue without the need to lock your CRV
- [Stake your Convex tokens](https://curve.convexfinance.com/stake#stake-cvx) (CVX) to earn Convex platform revenue
- [Stake & lock your Convex tokens](https://www.convexfinance.com/lock-cvx) to earn extra revenue from voting incentives, via the [Votium app](https://votium.app/), on top of Convex platform revenue

More information on Convex Finance can be found on their own academy page: https://www.convexfinance.com/academy

## Examples of commands

### Portfolio dashboard

    - TODO: Show all my positions on Convex
    - TODO: My total TVL on Convex
    - TODO: Show my LP positions on Convex
    - TODO: How much CRV I have staked on Convex?
    - TODO: Value of my locked CVX position on Convex

### Available markets & pools

    - TODO: Surface best opportunities on Convex based on my portfolio
    - TODO: Best yields on Convex?
    - TODO: Give me APY of Convex CRV staking
    - TODO: Show Convex pools with highest APY on Ethereum

### Stake and withdraw from Convex

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
