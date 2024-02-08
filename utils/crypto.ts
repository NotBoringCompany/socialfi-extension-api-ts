import CryptoJS from 'crypto-js';

/**
 * Generates a random Object ID for MongoDB collections.
 */
export const generateObjectId = (): string => {
    const randomBytes = CryptoJS.lib.WordArray.random(16); // Generate 16 random bytes
    const id = CryptoJS.enc.Hex.stringify(randomBytes); // Convert random bytes to hex string
    
    return id;
}