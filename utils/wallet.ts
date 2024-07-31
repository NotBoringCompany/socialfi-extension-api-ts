import { ethers } from 'ethers';
import { encryptPrivateKey } from './crypto';
import { UserWallet } from '../models/user';

/**
 * Creates a wallet for a user, returning both private and public keys.
 */
export const createUserWallet = (): UserWallet => {
    const wallet = ethers.Wallet.createRandom();

    const privateKey = wallet.privateKey;
    const address = wallet.address;

    return {
        address,
        encryptedPrivateKey: encryptPrivateKey(privateKey)
    }
}