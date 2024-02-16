import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

export const BLAST_TESTNET_PROVIDER = new ethers.providers.JsonRpcProvider(`https://sepolia.blast.io`);
export const DEPLOYER_WALLET = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, BLAST_TESTNET_PROVIDER);
export const LOTTERY_CONTRACT_ADDRESS = process.env.LOTTERY_CONTRACT!;

export const LOTTERY_ARTIFACT = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '../../artifacts/Lottery.json')
    ).toString()
);

/**
 * The lottery contract instance (using admin wallet)
 */
export const LOTTERY_CONTRACT = new ethers.Contract(
    LOTTERY_CONTRACT_ADDRESS,
    LOTTERY_ARTIFACT.abi,
    DEPLOYER_WALLET
);

/**
 * The lottery contract instance (using user wallet, requires their private key)
 */
export const LOTTERY_CONTRACT_USER = (privateKey: string) => {
    const wallet = new ethers.Wallet(privateKey, BLAST_TESTNET_PROVIDER);

    return new ethers.Contract(
        LOTTERY_CONTRACT_ADDRESS,
        LOTTERY_ARTIFACT.abi,
        wallet
    );
}