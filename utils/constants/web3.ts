import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

export const BLAST_TESTNET_PROVIDER = new ethers.providers.JsonRpcProvider(`https://sepolia.blast.io`);
export const ETH_MAINNET_PROVIDER = new ethers.providers.JsonRpcBatchProvider(`	https://api.securerpc.com/v1`);

/** Gets a deployer wallet instance based on the provider the deployer wallet will operate in */
export const DEPLOYER_WALLET = (provider: ethers.providers.JsonRpcProvider) => {
    return new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
}

export const LOTTERY_CONTRACT_ADDRESS = process.env.LOTTERY_CONTRACT!;
export const COOKIE_CONTRACT_ADDRESS = process.env.COOKIE_CONTRACT!;
export const COOKIE_CONTRACT_DECIMALS = 8;

export const KOS_CONTRACT_ADDRESS = process.env.KOS_CONTRACT!;
export const KEYCHAIN_CONTRACT_ADDRESS = process.env.KEYCHAIN_CONTRACT!;
export const SUPERIOR_KEYCHAIN_CONTRACT_ADDRESS = process.env.SUPERIOR_KEYCHAIN_CONTRACT!;

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
    DEPLOYER_WALLET(BLAST_TESTNET_PROVIDER)
);

/**
 * The cookie contract instance (using admin wallet)
 */
export const COOKIE_CONTRACT = new ethers.Contract(
    COOKIE_CONTRACT_ADDRESS,
    COOKIE_ARTIFACT.abi,
    DEPLOYER_WALLET(BLAST_TESTNET_PROVIDER)
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