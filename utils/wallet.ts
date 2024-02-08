import { ethers } from 'ethers';

/**
 * Creates a wallet for a user, returning both private and public keys.
 */
export const createUserWallet = (): {privateKey: string, publicKey: string} => {
    const wallet = ethers.Wallet.createRandom();

    const privateKey = wallet.privateKey;
    const publicKey = wallet.address;

    return {
        privateKey,
        publicKey
    }
}