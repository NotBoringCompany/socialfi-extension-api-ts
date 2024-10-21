import CryptoJS from 'crypto-js';
import { BLAST_TESTNET_PROVIDER } from './constants/web3';
import { ReturnValue, Status } from './retVal';
import { ethers } from 'ethers';
import { solidityKeccak256 } from 'ethers/lib/utils';

/**
 * Generates a random Object ID for MongoDB collections.
 */
export const generateObjectId = (): string => {
    const randomBytes = CryptoJS.lib.WordArray.random(16); // Generate 16 random bytes
    const id = CryptoJS.enc.Hex.stringify(randomBytes); // Convert random bytes to hex string

    return id;
}

/**
 * Generates a random hash salt for cryptographic operations.
 */ 
export const generateHashSalt = (): string => {
    const randomBytes = CryptoJS.lib.WordArray.random(32); // Generate 32 random bytes
    const salt = CryptoJS.enc.Hex.stringify(randomBytes); // Convert random bytes to hex string

    // keccak256 the salt 
    return solidityKeccak256(['string'], [salt]);
}

/**
 * Generates a data hash for Wonderbits-contract related actions given the `address` and `salt`.
 */
export const generateWonderbitsDataHash = (address: string, salt: string): string => {
    return solidityKeccak256(['address', 'bytes'], [address, salt]);
}

/**
 * Generates a referral code for a user.
 */
export const generateReferralCode = (): string => {
    // referral codes start with 'WBRC' and are followed by 8 random characters (all caps)
    return 'WBRC' + CryptoJS.lib.WordArray.random(8).toString().toUpperCase();
}

/**
 * Generates a starter code for a user.
 */
export const generateStarterCode = (): string => {
    // starter codes start with 'WBSC' and are followed by 12 random characters (all caps)
    return 'WBSC' + CryptoJS.lib.WordArray.random(12).toString().toUpperCase();
}

/**
 * Used to encrypt sensitive data, such as state payloads in OAuth2.
 */
export const encrypt = (data: string): string => {
    const secretKey = CryptoJS.enc.Utf8.parse(process.env.ENCRYPTION_KEY!);
    const iv = CryptoJS.enc.Utf8.parse(process.env.IV); // IV should be 16 bytes
    const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(data), secretKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.toString();
}

/**
 * Used to decrypt sensitive data, such as state payloads in OAuth2.
 */
export const decrypt = (cipherText: string) => {
    const secretKey = CryptoJS.enc.Utf8.parse(process.env.ENCRYPTION_KEY);
    const iv = CryptoJS.enc.Utf8.parse(process.env.IV); // IV should be 16 bytes
    const decrypted = CryptoJS.AES.decrypt(cipherText, secretKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return CryptoJS.enc.Utf8.stringify(decrypted);
}