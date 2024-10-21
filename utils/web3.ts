import { ethers } from 'ethers';

/**
 * Converts a random string into a Solidity bytes32 format.
 */
export const convertToBytes32 = (str: string): string => {
    console.log(ethers.utils.formatBytes32String(str));
    return ethers.utils.formatBytes32String(str);
}
