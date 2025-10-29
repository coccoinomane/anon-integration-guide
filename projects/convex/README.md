# Convex Finance Yield Maximization

Convex Finance allows you to maximize yield from [Curve Finance](https://curve.fi/), [Frax Finance](https://frax.com/) and other Decentralized Finance platforms. More information on Convex Finance can be found on their own academy page: https://www.convexfinance.com/academy

## Worth noting

- This integration only supports Curve Finance on Ethereum, which as of Oct 2025 represents more than 90% of Convex total TVL.

- Convex has a very limited APYs, which I implemented in [./src/client.ts](./src/client.ts). Most of the data fetching operations performed by this integration are done directly on the blockchain. In particular, the portfolio & opportunities tools perform many about 30-40 RPC multicalls each: make sure to use a good RPC provider to avoid rate limiting errors.

- Computing accurate APYs was tricky, for more details see:
    - https://discord.com/channels/820795644494610432/864157305566527508/1428627572274630727
    - https://docs.convexfinance.com/convexfinanceintegration/cvx-minting
    - https://etherscan.io/address/0x5Fba69a794F395184b5760DAf1134028608e5Cd1#readContract
    - https://discord.com/channels/820795644494610432/864157305566527508/880860136523059210

## Examples of commands

### Portfolio dashboard

- Show all my positions on Ethereum on Convex
- Show my LP positions on Ethereum on Convex
- Do I have any Curve positions I can deposit on Convex?
- My total TVL on Ethereum on Convex
- Value of my CRV+cvxCRV position on Ethereum on Convex?
- Value of my WETH lending vault on Ethereum on Convex?

Please note that the portfolio tool will also surface Curve LP tokens that are not yet deposited on Convex, and suggest to deposit them.

### Yield opportunities

- Best yields for WETH on Convex on Ethereum?
- Show me lending opportunities for BTC on Convex on Ethereum
- Convex pools with USDe on Ethereum
- APY of the Convex FRAX+USDe pool on Ethereum on Convex
- Am I better off lending my WETH or LPing it on Convex on Ethereum?

### Deposit Curve tokens into Convex

- Deposit all of my USDC-USDT liquidity on Convex on Ethereum
- Deposit 50% of my ETH-stETH liquidity on Convex on Ethereum
- Deposit 0.1 LP tokens in Convex pool crv+cvxCRV on Ethereum
- Deposit \$100 worth of CRV+cvxCRV on Convex on Ethereum
- Deposit my Curve sreUSD lending position on Convex

Please note that the tool will deposit & stake the tokens in one transaction.

### Withdraw Curve tokens from Convex

- Withdraw all of my liquidity from ETH-stETH Convex pool on Ethereum
- Withdraw half of my liquidity from ETH-stETH Convex pool on Ethereum
- Withdraw my sreUSD lending position from Convex
- Withdraw only my unstaked tokens from ETH-stETH Convex pool on Ethereum

Please note that:

- The tool will unstake & withdraw the tokens in one transaction.
- Any existing rewards will be claimed too.
- By default, the percentage refers to the staked amount of tokens. However, if the tool detects unstaked tokens as well, it will ask the user if they want to withdraw them too.

## Claim rewards

- Show my claimable rewards on Convex on Ethereum
- Claim all rewards on Convex on Ethereum
- Claim rewards from pool CRV+cvxCRV on Convex on Ethereum

### CRV and CVX staking

- NOT IMPLEMENTED: How much CRV I have staked on Convex?
- NOT IMPLEMENTED: Value of my locked CVX position on Convex
- NOT IMPLEMENTED: Convert and stake my CRV on Convex
- NOT IMPLEMENTED: Stake and lock 100 CVX on Convex
- NOT IMPLEMENTED: Give me APY of Convex CRV staking on Ethereum

Please note that when (and if) we will implement CRV to cvxCRV conversion, we should be mindful that, as of Oct 2025, cvxCRV is heavily depegged from CRV, see [here](https://www.defiwars.xyz/projects/convex) and [here](https://d.pr/i/gFtnBU).

## Convex protocol KB

- The main features supported by Convex Finance are:
    - [Stake your Curve positions](https://curve.convexfinance.com/stake), be it a liquidity position or a Lending Vault crvUSD token, to earn max-boosted rewards
    - [Convert your CRV tokens](https://curve.convexfinance.com/stake) to cvxCRV, a liquid token that, once staked, accrues Curve platform revenue without the need to lock your CRV
    - [Stake your CVX tokens](https://curve.convexfinance.com/stake#stake-cvx) to earn a share of Convex platform revenue
    - [Lock your CVX tokens](https://www.convexfinance.com/lock-cvx) to earn a share of of Convex platform revenue and to gain voting weights, which can earn you incentives via [Votium app](https://votium.app/).
- A Convex LP token is a deposit/receipt token that the user receives in exchange for depositing Curve liquidity on Convex
- After obtaining a Convex LP token, it can then be further staked on Convex to earn boosted CRV and (sometimes) CVX rewards; this
  is the whole point of it.
- One can also deposit & stake Curve lending positions (a.k.a. Llamalend lending vaults). Again, after depositing the Curve lending vault token one obtains from Convex a receipt token.
- In summary:
    - you deposit Curve LP tokens to obtain Convex LP tokens
    - you deposit Curve/Llamalend lending vault tokens to obtain Convex LV tokens
    - you stake Convex LP or LV tokens to earn boosted CRV and (sometimes) CVX rewards
- At the smart contract level, Convex does not make a difference between LP and lending vault tokens. They are just positions that can earn rewards. Both belong to the same entity and are indexed by the same sequential pool ID (\_pid); see [Convex (very terse) docs](https://docs.convexfinance.com/convexfinanceintegration/booster) for more details.
- To obtain a lending position suitable for being deposited on Curve, the user has to deposit their crvUSD tokens in a Llamalend vault (e.g. https://www.curve.finance/lend/ethereum/markets/one-way-market-12/vault/deposit).
- Each Llamalend vault has a specific collateral (e.g. WETH) hence Convex LV tokens shown on Convex UI always contain a token name (screenshot > https://d.pr/i/DpYS2p)

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
- `--debug-viem`: Show the output of every blockchain call
- `--rpc <url>`: Custom RPC URL to use for blockchain interactions

## Useful links

- [Curve Staking page](https://curve.convexfinance.com/stake)
- [Curve Claim page](https://curve.convexfinance.com/claim)
- [Lock CVX page](https://www.convexfinance.com/lock-cvx)
- [Votium app for bribes/incentives](https://votium.app/)

## Transactions

- [Deposit and stake LP](https://etherscan.io/tx/0x6daf22d6cae0029d483f87619a0a75777162a7dc15a01f38d41960f748aa213a)
- [Unstake and withdraw LP](https://etherscan.io/tx/0xc17f5a231c1afc73407576364bdc14281c87843ddb0f379b52f5b607facf1027)
- [Claim all rewards](https://etherscan.io/tx/0x976883b4e27d5646774ece1978668d7a94788751c8df5d3dcfe6c97d4753ece6)
- [Stake CVX](https://etherscan.io/tx/0x75b94bb910aa80eb4e74f05835e8eb1b66ab806cc1519cf61ac12e2a2ae31ab3)
- [Lock CVX](https://etherscan.io/tx/0xabb682980876276e4ebf9a60a15b4c19d96467b1d5e1a6903ebbc221f33740fa)
- [Stake crvUSD Lending Vault token](https://etherscan.io/tx/0xbc6d38aedf85ca04aeaf77929d1757ff9c28ee2ffec89e879b9fa68fd5e7b807)
