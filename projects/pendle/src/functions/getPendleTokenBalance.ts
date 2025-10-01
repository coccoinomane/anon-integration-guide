import { Address, erc20Abi, formatUnits } from 'viem';
import { EVM, EvmChain, FunctionReturn, toResult, FunctionOptions } from '@heyanon/sdk';
import { supportedChains } from '../constants';
import { fetchTokenInfoFromAddress } from '../helpers/tokens';
import { PendleClient } from '../helpers/client';

interface Props {
    chainName: string;
    tokenAddress: Address;
    account: `0x${string}` | null;
}

export async function getPendleTokenBalance({ chainName, tokenAddress, account }: Props, { notify, evm: { getAddress, getProvider } }: FunctionOptions): Promise<FunctionReturn> {
    // Validatation
    const chainId = EVM.utils.getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Unsupported chain: ${chainName}`, true);

    // Fetch token info
    const tokenInfo = await fetchTokenInfoFromAddress(getProvider(chainId), tokenAddress);
    if (!tokenInfo) return toResult(`Token not found: ${tokenAddress}`, true);
    account = account ?? (await getAddress());

    const publicClient = getProvider(chainId);
    
    // Return if the token is not a Pendle token
    const pendleClient = new PendleClient();
    const assets = await pendleClient.getAllAssets(chainId);
    if (!assets.find((a) => a.address.toLowerCase() === tokenInfo.address.toLowerCase())) {
        return toResult(`The token ${tokenInfo.symbol} does not seem to be a Pendle token`);
    }

    await notify(`Getting ${tokenInfo.symbol} balance for ${account ?? 'your wallet'}...`);

    const balance = await publicClient.readContract({
        address: tokenInfo.address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account],
    });

    return toResult(`${tokenInfo.symbol} balance: ${formatUnits(balance, tokenInfo.decimals)}`);
}
