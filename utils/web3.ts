import { ethers } from 'ethers';
import { BLAST_TESTNET_PROVIDER, LOTTERY_CONTRACT, WONDERBITS_CONTRACT } from './constants/web3'

/**
 * Gets the Lottery contract's balance; used for prize pool determination during draws.
 */
export const getLotteryContractBalance = async (): Promise<number> => {
    const balance = await BLAST_TESTNET_PROVIDER.getBalance(LOTTERY_CONTRACT.address);

    // convert the balance in wei to ether
    return parseFloat(ethers.utils.formatEther(balance));
}

/**
 * Converts a random string into a Solidity bytes32 format.
 */
export const convertToBytes32 = (str: string): string => {
    console.log(ethers.utils.formatBytes32String(str));
    return ethers.utils.formatBytes32String(str);
}
