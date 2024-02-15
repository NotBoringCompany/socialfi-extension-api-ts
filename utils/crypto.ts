import CryptoJS from 'crypto-js';
import { solidityPackedKeccak256 } from 'ethers';
import { BLAST_TESTNET_PROVIDER } from './constants/web3';
import { ReturnValue, Status } from './retVal';

/**
 * Generates a random Object ID for MongoDB collections.
 */
export const generateObjectId = (): string => {
    const randomBytes = CryptoJS.lib.WordArray.random(16); // Generate 16 random bytes
    const id = CryptoJS.enc.Hex.stringify(randomBytes); // Convert random bytes to hex string

    return id;
}

/**
 * Generates a random server seed for lottery draws.
 */
export const generateServerSeed = (): string => {
    return CryptoJS.lib.WordArray.random(32).toString();
}

/**
 * Hashes a server seed from `generateServerSeed` using SHA-256.
 */
export const hashedServerSeed = (seed: string): string => {
    return CryptoJS.SHA256(seed).toString();
}

/**
 * Generates a random draw seed for lottery draws.
 */
export const generateDrawSeed = async (): Promise<ReturnValue> => {
    try {
        const blockNumber = await BLAST_TESTNET_PROVIDER.getBlockNumber();
        // ensure to get a block that was mined (here we use 6 blocks before the latest block)
        const block = await BLAST_TESTNET_PROVIDER.getBlock(blockNumber - 6);

        if (!block) {
            return {
                status: Status.ERROR,
                message: `(generateDrawSeed) Failed to get block number ${blockNumber - 6}`
            }
        }

        // combine block hash and timestamp
        const drawSeed = solidityPackedKeccak256(
            ['bytes32', 'uint256'],
            [block.hash, block.timestamp]
        );

        return {
            status: Status.SUCCESS,
            message: '(generateDrawSeed) Draw seed generated successfully',
            data: {
                drawSeed
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(generateDrawSeed) Err: ${err.message}`
        }
    }
}