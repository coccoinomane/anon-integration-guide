# Pendle Finance Yield Trading

Pendle Finance allows you to separate interest bearing assets such as Lido's stETH and Ethena's sUSDe into two components: a principal token (PT) with a fixed interest rate and a yield token (YT) with a variable interest rate. You can then trade the PT and YT separately, for example with the purpose of betting on the expected yield from the underlying asset.

More information on Pendle Finance can be found on their own academy page: https://app.pendle.finance/trade/education

## Examples of commands

### Portfolio dashboard

    - Show all my positions on Pendle
    - My total TVL on Pendle
    - Show my YTs on Pendle
    - Show my pools on Pendle
    - Value of my stETH position on Base chain on Pendle

Please note that:

- portfolio tools return positions across all chains, without the need to specify the chain
- for each position both the token balance and dollar valuations will be shown

### Available markets & pools

    - Best fixed yields on Pendle on Ethereum?
    - Best fixed yields on Pendle on Ethereum for USDe token?
    - Give me info on Pendle sUSDe market on Ethereum
    - Show Pendle pools with highest APY on Ethereum
    - Best opportunties on Pendle to LP USDe on Ethereum

### Buy PT and YT tokens

    - Swap 100 USDC for PT wstETH on Pendle on Ethereum // swap any token to Pendle tokens
    - Swap 100 USDC for YT wstETH on Pendle on Ethereum // same but buy yield tokens instead
    - Swap 1 ETH for PT wstETH on Pendle on Ethereum // you can also swap native tokens
    - Swap 100 USDC for PT wstETH on Pendle on Ethereum with 1% slippage tolerance // specify slippage
    - Swap half of my PT cbETH for ETH on Pendle on Base // supports relative amounts
    - Sell half of my PT cbETH to ETH on Pendle on Base // same as above
    - Swap all of my LP USDe to ETH on Pendle on Base // can also add/remove liquidity (same as dedicated add/remove liquidity tools)

Please note that:

- If the user does not specify the expiry date, and multiple expiry dates are available for the requested asset, the agent will ask the user to specify which one to use
- After buying PT and YT tokens, the tool will tell the user when these tokens will expire
- Pendle does not allow to:
    - swap directly between two regular (i.e. non-Pendle) tokens
    - roll over directly from PT to YT and viceversa
    - roll over directly from one market's YT to another market's YT
    - roll over directly from one market's LP to another market's PT
- The above limitations can be bypassed by performing an intermediate swap, e.g. you can roll over from PT to YT by first swapping PT to the underlying token (or any regular token), and then swapping the underlying token to YT.

### Convert between Pendle positions (roll over)

    - Convert all of my PT wstETH to PT USDe on Pendle on Ethereum
    - Roll over all of my PT wstETH to PT USDe on Pendle on Ethereum // same as above
    - Roll over half of my wstETH LP to an sUSDe LP on Pendle on Ethereum // roll over liquidity

### Add and remove liquidity

    - Add 1 stETH of liquidity to wstETH market on Pendle on Ethereum // in-kind liquidity add
    - Add 100 USDC of liquidity to wstETH market on Pendle on Ethereum // zap in from custom token
    - Zap 100 USDC to wstETH market on Pendle on Ethereum // same as above
    - Zap 100 USDC to wstETH market on Pendle on Ethereum, with 1% slippage tolerance // zap in with custom slippage
    - Remove my liquidity from wstETH market on Pendle on Ethereum // in-kind liquidity remove
    - Remove my liquidity from wstETH market to USDC on Pendle on Ethereum // zap out to custom token
    - Zap my liquidity from wstETH market to USDC on Pendle on Ethereum // same as above
    - Remove half of my liquidity from wstETH market to USDC on Pendle on Ethereum // remove just a part of liquidity

Please note that you will be able to zap in / zap out to all the tokens supported by the DEX aggregators used by Pendle (Kyberswap, Okx, etc.), including those not listed in the token dropdown in the Pendle UI.

### Redeem expired positions

    - Redeem my expired PT wstETH position to ETH on Pendle on Ethereum
    - Redeem my expired wstETH LP position to USDC on Pendle on Ethereum
    - Redeem 50% of my expired PT cbETH position to ETH on Pendle on Base
    - Redeem my expired PT USDe position to USDe on Pendle on Ethereum

Please note that:

- The function will automatically check if the market has expired using the `isExpired()` view function on the market contract
- If the market has not expired yet, you will be instructed to use the swap function instead
- You can redeem both PT (Principal Token) and LP (Liquidity Pool) positions
- The redemption can be to any token supported by the DEX aggregators (with automatic zap out)

## Rewards

    - Show my claimable rewards on Base on Pendle
    - Claim all of my available rewards on Ethereum on Pendle
    - Claim rewards for the sUSDe market on Pendle on Ethereum

Please note that YT interests are accrued as SY tokens. Since SY tokens are not user friendly, we convert them to the underlying token (e.g. wstETH or sUSDe), just like you can do on the UI if you select the "Auto unwrap" option ([screenshot](https://d.pr/i/SSDarx).

### Pendle tokens

    - Address of cbETH yield token on Pendle on Base
    - My balance of cbETH yield token on Pendle on Base
    - Address and balance of mUSDC SY token on Pendle on Base
    - Address and balance of wstETH principal token expiring on December 2027 on Pendle on Ethereum
    - Address and balance of wstETH principal tokens that expired in 2023 on Pendle on Ethereum

The Pendle token resolver is a crucial component of the integration as it determines what part of the protocol the user wants to interact with. The resolver first checks the token name and symbol, then if it does not find a match, it scans available markets that match the user query.

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
- [Reward claiming via Pendle Router](https://docs.pendle.finance/pendle-v2/Developers/Contracts/PendleRouter/ApiReference/MiscFunctions#redeemdueinterestandrewardsv2)
- [YT rewards claim TX](https://basescan.org/tx/0x07923989d21a9a181976c81f9cf6f7ad6d633eb260006cf3b6cb237c6ca44013)
