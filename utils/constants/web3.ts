import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

export const BLAST_TESTNET_PROVIDER = new ethers.providers.JsonRpcProvider(`https://sepolia.blast.io`);
export const DEPLOYER_WALLET = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, BLAST_TESTNET_PROVIDER);
export const LOTTERY_CONTRACT_ADDRESS = process.env.LOTTERY_CONTRACT!;
export const COOKIE_CONTRACT_ADDRESS = process.env.COOKIE_CONTRACT!;

export const COOKIE_CONTRACT_DECIMALS = 8;

export const LOTTERY_ARTIFACT = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '../../artifacts/Lottery.json')
    ).toString()
);

export const COOKIE_ARTIFACT = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '../../artifacts/Cookie.json')
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
 * The cookie contract instance (using admin wallet)
 */
export const COOKIE_CONTRACT = new ethers.Contract(
    COOKIE_CONTRACT_ADDRESS,
    COOKIE_ARTIFACT.abi,
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

/**
 * The cookie contract instance (using user wallet, requires their private key)
 */
export const COOKIE_CONTRACT_USER = (privateKey: string) => {
    const wallet = new ethers.Wallet(privateKey, BLAST_TESTNET_PROVIDER);

    return new ethers.Contract(
        COOKIE_CONTRACT_ADDRESS,
        COOKIE_ARTIFACT.abi,
        wallet
    );
}