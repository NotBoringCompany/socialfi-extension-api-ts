import { ethers } from 'ethers';
import { BLAST_TESTNET_PROVIDER, LOTTERY_CONTRACT } from './constants/web3'

/**
 * Gets the Lottery contract's balance; used for prize pool determination during draws.
 */
export const getLotteryContractBalance = async (): Promise<number> => {
    const balance = await BLAST_TESTNET_PROVIDER.getBalance(LOTTERY_CONTRACT.address);

    // convert the balance in wei to ether
    return parseFloat(ethers.utils.formatEther(balance));
}