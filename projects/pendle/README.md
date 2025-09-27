# Pendle Finance Yield Trading

Pendle Finance allows you to separate interest bearing assets such as Lido's stETH and Ethena's sUSDe into two components: a principal token (PT) with a fixed interest rate and a yield token (YT) with a variable interest rate. You can then trade the PT and YT separately, for example with the purpose of betting on the expected yield from the underlying asset.

More information on Pendle Finance can be found on their own academy page: https://app.pendle.finance/trade/education

## Examples of commands

### Portfolio dashboard

    - Show all my positions on Pendle
    - Show all positions of wallet 0x5e014aa0649102e07c074f498845f01bcd520317 on Pendle
    - My total TVL on Pendle
    - Show my YTs on Pendle
    - Show my pools on Pendle
    - Value of my stETH position on Base chain on Pendle

Please note that most portfolio tools return positions across all chains, without the need to specify the chain.

### Available markets & pools

    - Best fixed yields on Pendle on Ethereum?
    - Best fixed yields on Pendle on Ethereum for USDe token?
    - Give me info on Pendle sUSDe market on Ethereum
    - Show Pendle pools with highest APY on Ethereum
    - Best opportunties on Pendle to LP USDe on Ethereum

### Mint & redeem

    - [TODO] Mint PT and YT from my sUSDe on Ethereum on Pendle
    - [TODO] Convert my sUSDe on Ethereum on Pendle // same as above
    - [TODO] Redeem my stETH PT and YT on Ethereum on Pendle

### Buy and sell PT & YT tokens

    - [TODO] Swap 100 USDC for PT-wstETH on Ethereum on Pendle
    - [TODO] Swap 100 USDC for YT-wstETH on Ethereum on Pendle // same but buy yield tokens instead
    - [TODO] Swap 100 USDC for PT-wstETH on Ethereum on Pendle with 1% slippage tolerance // specify slippage
    - [TODO] Buy 100 PT-wstETH on Ethereum on Pendle // will use underlying token to buy (wstETH)
    - [TODO] Swap USDC to get exactly 1 PT-wstETH on Ethereum on Pendle // obtain exact amount IS THIS EVEN POSSIBLE?

### Add and remove liquidity

    - Add 1 stETH of liquidity to wstETH market on Ethereum on Pendle // in-kind liquidity add
    - Add 100 USDC of liquidity to wstETH market on Ethereum on Pendle // zap in from custom token
    - Zap 100 USDC to wstETH market on Ethereum on Pendle // same as above
    - Zap 100 USDC to wstETH market on Ethereum on Pendle, with 1% slippage tolerance // zap in with custom slippage
    - Remove my liquidity from wstETH market on Pendle on Ethereum // in-kind liquidity remove
    - Remove my liquidity from wstETH market to USDC on Pendle on Ethereum // zap out to custom token
    - Zap my liquidity from wstETH market to USDC on Pendle on Ethereum // same as above
    - Remove half of my liquidity from wstETH market to USDC on Pendle on Ethereum // remove just a part of liquidity

Please note that you will be able to zap in / zap out to all the tokens supported by the DEX aggregators used by Pendle (Kyberswap, Okx, etc.), including those not listed in the token dropdown in the Pendle UI.

## Rewards

    - [TODO] Show my claimable rewards on Pendle
    - [TODO] Claim all my rewards across chains on Pendle
    - [TODO] Claim rewards for the sUSDe Ethereum market on Pendle

### Find addresses of Pendle tokens

    - Address of Pendle wstETH principal token expiring on December 2027 on Ethereum
    - Address of Pendle cbETH yield token on Base
    - Address of Pendle mUSDC SY token on Base

## Test with the local agent

I've built a simple agent called `ask-pendle` to test the integration. To run it, you need to configure .env:

```bash
cd projects/pendle
pnpm install
cp .env.example .env
# insert test wallet private key into .env
# insert OpenAI or DeepSeek key into .env
```

and then you can ask questions directly:

```bash
pnpm ask-pendle "What can I do on Pendle?"
pnpm ask-pendle "LP 1000 USDC into USDe market on Ethereum"
pnpm ask-pendle "Zap half of my liquidity from USDe market to ETH on Ethereum"
```

Options:

- `--debug-llm`: Show the actual LLM responses
- `--debug-tools`: Show the output of every tool call

## Worth noting

- The integration will automatically determine whether to zap in / zap out to a custom token or not, based on the input / output token provided.
- Zapping tokens not whitelisted by Pendle (e.g. WBTC on Base) will fail with a clear error message.

## Useful links

- [Pendle V2 API docs](https://docs.pendle.finance/Developers/Backend/BackendAndHostedSDK)
- [Pendle V2 API reference](https://api-v2.pendle.finance/core/docs#/)
- [Pendle V2 API examples](https://github.com/pendle-finance/pendle-examples-public/tree/main)
