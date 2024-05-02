import { ethers } from 'ethers';

/**
 * Creates a wallet for a user, returning both private and public keys.
 */
export const createUserWallet = (): {address: string, privateKey: string} => {
    const wallet = ethers.Wallet.createRandom();

    const privateKey = wallet.privateKey;
    const address = wallet.address;

    return {
        address,
        privateKey
    }
}