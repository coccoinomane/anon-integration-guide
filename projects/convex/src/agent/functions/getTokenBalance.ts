import { Address, erc20Abi, formatUnits } from 'viem';
import { EVM, EvmChain, FunctionReturn, toResult, FunctionOptions } from '@heyanon/sdk';
import { supportedChains } from '../../constants';
import { fetchTokenInfoFromAddress } from '../../helpers/tokens';

interface Props {
    chainName: string;
    tokenAddress: Address;
    account: Address | null;
}

/**
 * Gets the token balance for a specific address.
 * Returns balance in human readable format.
 *
 * @param {Object} props - The input parameters
 * @param {string} props.chainName - Name of the blockchain network
 * @param {Address} props.tokenAddress - Address of token to check
 * @param {Address} props.account - Address to check balance for
 * @param {FunctionOptions} options - HeyAnon SDK options, including provider and notification handlers
 * @returns {Promise<FunctionReturn>} Token balance with symbol
 */
export async function getTokenBalance({ chainName, tokenAddress, account }: Props, { notify, evm: { getAddress, getProvider } }: FunctionOptions): Promise<FunctionReturn> {
    const chainId = EVM.utils.getChainFromName(chainName as EvmChain);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Unsupported chain: ${chainName}`, true);

    const token = await fetchTokenInfoFromAddress(getProvider(chainId), tokenAddress);
    if (!token) return toResult(`Token not found: ${tokenAddress}`, true);
    account = account ?? (await getAddress());

    const publicClient = getProvider(chainId);

    await notify(`Getting ${token.symbol} balance for ${account ?? 'your wallet'}...`);

    const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account],
    });

    return toResult(`${token.symbol} balance: ${formatUnits(balance, token.decimals)}`);
}
