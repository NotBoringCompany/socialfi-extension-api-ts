import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

import * as dotenv from 'dotenv';
import TonWeb from 'tonweb';

dotenv.config();

export const BLAST_TESTNET_PROVIDER = new ethers.providers.JsonRpcProvider(`https://sepolia.blast.io`);
// export const ETH_MAINNET_PROVIDER = new ethers.providers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY!}`);
export const ETH_MAINNET_PROVIDER = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY!}`);
export const XPROTOCOL_TESTNET_PROVIDER = new ethers.providers.JsonRpcProvider(`https://rpc-xprotocol-testnet-kzg4iy2205.t.conduit.xyz/${process.env.X_PROTOCOL_TESTNET_API_KEY!}`);
/**
 * temporary public testnet provider for Kairos (kaia's testnet)
 */
export const KAIA_TESTNET_PROVIDER = new ethers.providers.JsonRpcProvider(`https://kaia-kairos.blockpi.network/v1/rpc/public`);

/// TonWeb instance with API Key
export const TON_WEB = new TonWeb(new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC', { apiKey: process.env.TON_API_KEY} ));

/// W5 receiver address for IAP payments made in TON
export const TON_RECEIVER_ADDRESS = 'UQAWfBEcr61zy4Ke8ewXhKiYx5t07xKGKuCaQ0KYH4nb14aM';

/// BASE URLS FOR APIS USED FOR WEB3 RELATED OPERATIONS (MAINLY PRICE FETCHING)
export const BINANCE_API_BASE_URL = `https://data-api.binance.vision`;
export const KUCOIN_API_BASE_URL = `https://api.kucoin.com`;
export const GATEIO_API_BASE_URL = `https://api.gateio.ws`;

/** Gets a deployer wallet instance based on the provider the deployer wallet will operate in */
export const DEPLOYER_WALLET = (provider: ethers.providers.JsonRpcProvider) => {
    return new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
}

export const KOS_CONTRACT_ADDRESS = process.env.KOS_CONTRACT!;
export const KEYCHAIN_CONTRACT_ADDRESS = process.env.KEYCHAIN_CONTRACT!;
export const SUPERIOR_KEYCHAIN_CONTRACT_ADDRESS = process.env.SUPERIOR_KEYCHAIN_CONTRACT!;

// kaia's testnet contract addresses
export const WONDERBITS_CONTRACT_ADDRESS = process.env.WONDERBITS_CONTRACT!;
export const ISLANDS_CONTRACT_ADDRESS = process.env.ISLANDS_CONTRACT!;
export const BIT_COSMETICS_CONTRACT_ADDRESS = process.env.BIT_COSMETICS_CONTRACT!;
export const WONDERBITS_SFT_CONTRACT_ADDRESS = process.env.WONDERBITS_SFT_CONTRACT!;
export const CUSTODIAL_CONTRACT_ADDRESS = process.env.CUSTODIAL_CONTRACT!;

export const KOS_ARTIFACT = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '../../artifacts/KeyOfSalvation.json')
    ).toString()
);

export const KEYCHAIN_ARTIFACT = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '../../artifacts/Keychain.json')
    ).toString()
);

export const SUPERIOR_KEYCHAIN_ARTIFACT = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '../../artifacts/SuperiorKeychain.json')
    ).toString()
);

export const WONDERBITS_ARTIFACT = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '../../artifacts/Wonderbits.json')
    ).toString()
);

export const ISLANDS_ARTIFACT = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '../../artifacts/Islands.json')
    ).toString()
);

export const BIT_COSMETICS_ARTIFACT = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '../../artifacts/BitCosmetics.json')
    ).toString()
);

export const WONDERBITS_SFT_ARTIFACT = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '../../artifacts/WonderbitsSFT.json')
    ).toString()
);

export const CUSTODIAL_CONTRACT_ARTIFACT = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '../../artifacts/Custodial.json')
    ).toString()
);

/**
 * The keychain contract instance (using admin wallet)
 */
export const KOS_CONTRACT = new ethers.Contract(
    KOS_CONTRACT_ADDRESS,
    KOS_ARTIFACT.abi,
    DEPLOYER_WALLET(ETH_MAINNET_PROVIDER)
);

/**
 * The keychain contract instance (using admin wallet)
 */
export const KEYCHAIN_CONTRACT = new ethers.Contract(
    KEYCHAIN_CONTRACT_ADDRESS,
    KEYCHAIN_ARTIFACT.abi,
    DEPLOYER_WALLET(ETH_MAINNET_PROVIDER)
);

/**
 * The superior keychain contract instance (using admin wallet)
 */
export const SUPERIOR_KEYCHAIN_CONTRACT = new ethers.Contract(
    SUPERIOR_KEYCHAIN_CONTRACT_ADDRESS,
    SUPERIOR_KEYCHAIN_ARTIFACT.abi,
    DEPLOYER_WALLET(ETH_MAINNET_PROVIDER)
);

/**
 * The wonderbits contract instance (using admin wallet)
 */
export const WONDERBITS_CONTRACT = new ethers.Contract(
    WONDERBITS_CONTRACT_ADDRESS,
    WONDERBITS_ARTIFACT.abi,
    DEPLOYER_WALLET(KAIA_TESTNET_PROVIDER)
);

/**
 * The islands contract instance (using admin wallet)
 */
export const ISLANDS_CONTRACT = new ethers.Contract(
    ISLANDS_CONTRACT_ADDRESS,
    ISLANDS_ARTIFACT.abi,
    DEPLOYER_WALLET(KAIA_TESTNET_PROVIDER)
);

/**
 * The bit cosmetics contract instance (using admin wallet)
 */
export const BIT_COSMETICS_CONTRACT = new ethers.Contract(
    BIT_COSMETICS_CONTRACT_ADDRESS,
    BIT_COSMETICS_ARTIFACT.abi,
    DEPLOYER_WALLET(KAIA_TESTNET_PROVIDER)
);

/**
 * The wonderbits SFT contract instance (using admin wallet)
 */
export const WONDERBITS_SFT_CONTRACT = new ethers.Contract(
    WONDERBITS_SFT_CONTRACT_ADDRESS,
    WONDERBITS_SFT_ARTIFACT.abi,
    DEPLOYER_WALLET(KAIA_TESTNET_PROVIDER)
);

/**
 * The custodial contract instance (using admin wallet)
 */
export const CUSTODIAL_CONTRACT = new ethers.Contract(
    CUSTODIAL_CONTRACT_ADDRESS,
    CUSTODIAL_CONTRACT_ARTIFACT.abi,
    DEPLOYER_WALLET(KAIA_TESTNET_PROVIDER)
);

/**
 * The keychain contract instance (using user wallet, requires their private key)
 */
export const KOS_CONTRACT_USER = (privateKey: string) => {
    const wallet = new ethers.Wallet(privateKey, ETH_MAINNET_PROVIDER);

    return new ethers.Contract(
        KOS_CONTRACT_ADDRESS,
        KOS_ARTIFACT.abi,
        wallet
    );
}

/**
 * The keychain contract instance (using user wallet, requires their private key)
 */
export const KEYCHAIN_CONTRACT_USER = (privateKey: string) => {
    const wallet = new ethers.Wallet(privateKey, ETH_MAINNET_PROVIDER);

    return new ethers.Contract(
        KEYCHAIN_CONTRACT_ADDRESS,
        KEYCHAIN_ARTIFACT.abi,
        wallet
    );
}

/**
 * The superior keychain contract instance (using user wallet, requires their private key)
 */
export const SUPERIOR_KEYCHAIN_CONTRACT_USER = (privateKey: string) => {
    const wallet = new ethers.Wallet(privateKey, ETH_MAINNET_PROVIDER);

    return new ethers.Contract(
        SUPERIOR_KEYCHAIN_CONTRACT_ADDRESS,
        SUPERIOR_KEYCHAIN_ARTIFACT.abi,
        wallet
    );
}

/**
 * The wonderbits contract instance (using user wallet, requires their private key)
 */
export const WONDERBITS_CONTRACT_USER = (privateKey: string) => {
    const wallet = new ethers.Wallet(privateKey, ETH_MAINNET_PROVIDER);

    return new ethers.Contract(
        WONDERBITS_CONTRACT_ADDRESS,
        WONDERBITS_ARTIFACT.abi,
        wallet
    );
}

/**
 * The islands contract instance (using user wallet, requires their private key)
 */
export const ISLANDS_CONTRACT_USER = (privateKey: string) => {
    const wallet = new ethers.Wallet(privateKey, ETH_MAINNET_PROVIDER);

    return new ethers.Contract(
        ISLANDS_CONTRACT_ADDRESS,
        ISLANDS_ARTIFACT.abi,
        wallet
    );
}

/**
 * The bit cosmetics contract instance (using user wallet, requires their private key)
 */
export const BIT_COSMETICS_CONTRACT_USER = (privateKey: string) => {
    const wallet = new ethers.Wallet(privateKey, ETH_MAINNET_PROVIDER);

    return new ethers.Contract(
        BIT_COSMETICS_CONTRACT_ADDRESS,
        BIT_COSMETICS_ARTIFACT.abi,
        wallet
    );
}

/**
 * The wonderbits SFT contract instance (using user wallet, requires their private key)
 */
export const WONDERBITS_SFT_CONTRACT_USER = (privateKey: string) => {
    const wallet = new ethers.Wallet(privateKey, ETH_MAINNET_PROVIDER);

    return new ethers.Contract(
        WONDERBITS_SFT_CONTRACT_ADDRESS,
        WONDERBITS_SFT_ARTIFACT.abi,
        wallet
    );
}

/**
 * The custodial contract instance (using user wallet, requires their private key)
 */
export const CUSTODIAL_CONTRACT_USER = (privateKey: string) => {
    const wallet = new ethers.Wallet(privateKey, ETH_MAINNET_PROVIDER);

    return new ethers.Contract(
        CUSTODIAL_CONTRACT_ADDRESS,
        CUSTODIAL_CONTRACT_ARTIFACT.abi,
        wallet
    );
}

/**
 * Represents an array of all possible Wonderbits SFT IDs and their corresponding assets.
 * 
 * NOTE: Each asset is unique and has a corresponding ID. For example, each resource will have a unique ID instead of a shared ID for all resources.
 */
export const WONDERBITS_SFT_IDS = [
    {id: 1, asset: 'Stone'},
    {id: 2, asset: 'Copper'},
    {id: 3, asset: 'Iron'},
    {id: 4, asset: 'Silver'},
    {id: 5, asset: 'Gold'},
    {id: 6, asset: 'Tomato'},
    {id: 7, asset: 'Apple'},
    {id: 8, asset: 'Star Fruit'},
    {id: 9, asset: 'Melon'},
    {id: 10, asset: 'Dragon Fruit'},
    {id: 11, asset: 'Water'},
    {id: 12, asset: 'Maple Syrup'},
    {id: 13, asset: 'Honey'},
    {id: 14, asset: 'Moonlight Dew'},
    {id: 15, asset: 'Phoenix Tear'},
    {id: 16, asset: 'Candy'},
    {id: 17, asset: 'Chocolate'},
    {id: 18, asset: 'Juice'},
    {id: 19, asset: 'Burger'},
    {id: 20, asset: 'Gathering Progress Booster 10%'},
    {id: 21, asset: 'Gathering Progress Booster 25%'},
    {id: 22, asset: 'Gathering Progress Booster 50%'},
    {id: 23, asset: 'Gathering Progress Booster 100%'},
    {id: 24, asset: 'Gathering Progress Booster 200%'},
    {id: 25, asset: 'Gathering Progress Booster 300%'},
    {id: 26, asset: 'Gathering Progress Booster 500%'},
    {id: 27, asset: 'Gathering Progress Booster 1000%'},
    {id: 28, asset: 'Gathering Progress Booster 2000%'},
    {id: 29, asset: 'Gathering Progress Booster 3000%'},
    {id: 30, asset: 'Raft Speed Booster 1 Min'},
    {id: 31, asset: 'Raft Speed Booster 2 Min'},
    {id: 32, asset: 'Raft Speed Booster 3 Min'},
    {id: 33, asset: 'Raft Speed Booster 5 Min'},
    {id: 34, asset: 'Raft Speed Booster 10 Min'},
    {id: 35, asset: 'Raft Speed Booster 15 Min'},
    {id: 36, asset: 'Raft Speed Booster 30 Min'},
    {id: 37, asset: 'Raft Speed Booster 60 Min'},
    {id: 38, asset: 'Standard Wonderspin Ticket (I)'},
    {id: 39, asset: 'Standard Wonderspin Ticket (II)'},
    {id: 40, asset: 'Premium Wonderspin Ticket'},
    {id: 41, asset: 'Bit Orb (I)'},
    {id: 42, asset: 'Bit Orb (II)'},
    {id: 43, asset: 'Bit Orb (III)'},
    {id: 44, asset: 'Terra Capsulator (I)'},
    {id: 45, asset: 'Terra Capsulator (II)'},
    {id: 46, asset: 'Essence of Wonder'},
    {id: 47, asset: 'Light of Wonder'},
    {id: 48, asset: 'Silver Ingot'},
    {id: 49, asset: 'Grand Totem of Energy'},
    {id: 50, asset: 'Faded Continuum Relic'},
    {id: 51, asset: 'Copper Ingot'},
    {id: 52, asset: 'Gold Ingot'},
    {id: 53, asset: 'Wand of Transmutation'},
    {id: 54, asset: 'Tome of Augmentation'},
    {id: 55, asset: 'Potion of Unholy Enlightenment'},
    {id: 56, asset: 'Potion of Luck'},
    {id: 57, asset: 'Ancient Scroll of Augmentation'},
    {id: 58, asset: 'Ancient Tome of Augmentation'},
    {id: 59, asset: 'Small Totem of Energy'},
    {id: 60, asset: 'Potion of Enlightenment'},
    {id: 61, asset: 'Scroll of Augmentation'},
    {id: 62, asset: 'Parchment of Augmentation'},
    {id: 63, asset: 'Big Totem of Energy'},
    {id: 64, asset: 'Mythic Continuum Relic'},
    {id: 65, asset: 'Royal Scepter of Transmutation'},
    {id: 66, asset: 'Gleaming Continuum Relic'},
    {id: 67, asset: 'Iron Ingot'},
    {id: 68, asset: 'Staff of Transmutation'},
    {id: 69, asset: 'Potion of Divine Enlightenment'}
]