import { BigNumber, ethers, Event } from 'ethers';
import fs from 'fs';
import path from 'path';

import * as dotenv from 'dotenv';
import TonWeb from 'tonweb';
import { AssetType } from '../../models/asset';

dotenv.config();

export const BLAST_TESTNET_PROVIDER = new ethers.providers.JsonRpcProvider(`https://sepolia.blast.io`);
// export const ETH_MAINNET_PROVIDER = new ethers.providers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY!}`);
export const ETH_MAINNET_PROVIDER = new ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY!}`);
export const XPROTOCOL_TESTNET_PROVIDER = new ethers.providers.JsonRpcProvider(`https://rpc-xprotocol-testnet-kzg4iy2205.t.conduit.xyz/${process.env.X_PROTOCOL_TESTNET_API_KEY!}`);
/**
 * temporary public testnet provider for Kairos (kaia's testnet)
 */
export const KAIA_TESTNET_PROVIDER = new ethers.providers.JsonRpcProvider(`https://kaia-kairos.blockpi.network/v1/rpc/public`);
/** websocket instance of the Kaia Testnet Provider */
export const KAIA_TESTNET_PROVIDER_WS = new ethers.providers.JsonRpcProvider(`wss://public-en-kairos.node.kaia.io/ws`);

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
 * The wonderbits contract instance using KAIA Testnet's Websocket provider
 */
export const WONDERBITS_CONTRACT_WS = new ethers.Contract(
    WONDERBITS_CONTRACT_ADDRESS,
    WONDERBITS_ARTIFACT.abi,
    KAIA_TESTNET_PROVIDER_WS
)

/**
 * The islands contract instance (using admin wallet)
 */
export const ISLANDS_CONTRACT = new ethers.Contract(
    ISLANDS_CONTRACT_ADDRESS,
    ISLANDS_ARTIFACT.abi,
    DEPLOYER_WALLET(KAIA_TESTNET_PROVIDER)
);

/**
 * The islands contract instance using KAIA Testnet's Websocket provider
 */
export const ISLANDS_CONTRACT_WS = new ethers.Contract(
    ISLANDS_CONTRACT_ADDRESS,
    ISLANDS_ARTIFACT.abi,
    KAIA_TESTNET_PROVIDER_WS
)

/**
 * The bit cosmetics contract instance (using admin wallet)
 */
export const BIT_COSMETICS_CONTRACT = new ethers.Contract(
    BIT_COSMETICS_CONTRACT_ADDRESS,
    BIT_COSMETICS_ARTIFACT.abi,
    DEPLOYER_WALLET(KAIA_TESTNET_PROVIDER)
);

/**
 * The bit cosmetics contract instance using KAIA Testnet's Websocket provider
 */
export const BIT_COSMETICS_CONTRACT_WS = new ethers.Contract(
    BIT_COSMETICS_CONTRACT_ADDRESS,
    BIT_COSMETICS_ARTIFACT.abi,
    KAIA_TESTNET_PROVIDER_WS
)

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
    const wallet = new ethers.Wallet(privateKey, KAIA_TESTNET_PROVIDER);

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
    const wallet = new ethers.Wallet(privateKey, KAIA_TESTNET_PROVIDER);

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
    const wallet = new ethers.Wallet(privateKey, KAIA_TESTNET_PROVIDER);

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
    const wallet = new ethers.Wallet(privateKey, KAIA_TESTNET_PROVIDER);

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
    const wallet = new ethers.Wallet(privateKey, KAIA_TESTNET_PROVIDER);

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
export const WONDERBITS_SFT_IDS: Array<{
    id: number,
    asset: AssetType,
    type: 'resource' | 'food' | 'item'
}> = [
    {id: 1, asset: 'Stone', type: 'resource'},
    {id: 2, asset: 'Copper', type: 'resource'},
    {id: 3, asset: 'Iron', type: 'resource'},
    {id: 4, asset: 'Silver', type: 'resource'},
    {id: 5, asset: 'Gold', type: 'resource'},
    {id: 6, asset: 'Tomato', type: 'resource'},
    {id: 7, asset: 'Apple', type: 'resource'},
    {id: 8, asset: 'Star Fruit', type: 'resource'},
    {id: 9, asset: 'Melon', type: 'resource'},
    {id: 10, asset: 'Dragon Fruit', type: 'resource'},
    {id: 11, asset: 'Water', type: 'resource'},
    {id: 12, asset: 'Maple Syrup', type: 'resource'},
    {id: 13, asset: 'Honey', type: 'resource'},
    {id: 14, asset: 'Moonlight Dew', type: 'resource'},
    {id: 15, asset: 'Phoenix Tear', type: 'resource'},
    {id: 16, asset: 'Candy', type: 'food'},
    {id: 17, asset: 'Chocolate', type: 'food'},
    {id: 18, asset: 'Juice', type: 'food'},
    {id: 19, asset: 'Burger', type: 'food'},
    {id: 20, asset: 'Gathering Progress Booster 10%', type: 'item'},
    {id: 21, asset: 'Gathering Progress Booster 25%', type: 'item'},
    {id: 22, asset: 'Gathering Progress Booster 50%', type: 'item'},
    {id: 23, asset: 'Gathering Progress Booster 100%', type: 'item'},
    {id: 24, asset: 'Gathering Progress Booster 200%', type: 'item'},
    {id: 25, asset: 'Gathering Progress Booster 300%', type: 'item'},
    {id: 26, asset: 'Gathering Progress Booster 500%', type: 'item'},
    {id: 27, asset: 'Gathering Progress Booster 1000%', type: 'item'},
    {id: 28, asset: 'Gathering Progress Booster 2000%', type: 'item'},
    {id: 29, asset: 'Gathering Progress Booster 3000%', type: 'item'},
    {id: 30, asset: 'Raft Speed Booster 1 Min', type: 'item'},
    {id: 31, asset: 'Raft Speed Booster 2 Min', type: 'item'},
    {id: 32, asset: 'Raft Speed Booster 3 Min', type: 'item'},
    {id: 33, asset: 'Raft Speed Booster 5 Min', type: 'item'},
    {id: 34, asset: 'Raft Speed Booster 10 Min', type: 'item'},
    {id: 35, asset: 'Raft Speed Booster 15 Min', type: 'item'},
    {id: 36, asset: 'Raft Speed Booster 30 Min', type: 'item'},
    {id: 37, asset: 'Raft Speed Booster 60 Min', type: 'item'},
    {id: 38, asset: 'Standard Wonderspin Ticket (I)', type: 'item'},
    {id: 39, asset: 'Standard Wonderspin Ticket (II)', type: 'item'},
    {id: 40, asset: 'Premium Wonderspin Ticket', type: 'item'},
    {id: 41, asset: 'Bit Orb (I)', type: 'item'},
    {id: 42, asset: 'Bit Orb (II)', type: 'item'},
    {id: 43, asset: 'Bit Orb (III)', type: 'item'},
    {id: 44, asset: 'Terra Capsulator (I)', type: 'item'},
    {id: 45, asset: 'Terra Capsulator (II)', type: 'item'},
    {id: 46, asset: 'Essence of Wonder', type: 'item'},
    {id: 47, asset: 'Light of Wonder', type: 'item'},
    {id: 48, asset: 'Silver Ingot', type: 'item'},
    {id: 49, asset: 'Grand Totem of Energy', type: 'item'},
    {id: 50, asset: 'Faded Continuum Relic', type: 'item'},
    {id: 51, asset: 'Copper Ingot', type: 'item'},
    {id: 52, asset: 'Gold Ingot', type: 'item'},
    {id: 53, asset: 'Wand of Transmutation', type: 'item'},
    {id: 54, asset: 'Tome of Augmentation', type: 'item'},
    {id: 55, asset: 'Potion of Unholy Enlightenment', type: 'item'},
    {id: 56, asset: 'Potion of Luck', type: 'item'},
    {id: 57, asset: 'Ancient Scroll of Augmentation', type: 'item'},
    {id: 58, asset: 'Ancient Tome of Augmentation', type: 'item'},
    {id: 59, asset: 'Small Totem of Energy', type: 'item'},
    {id: 60, asset: 'Potion of Enlightenment', type: 'item'},
    {id: 61, asset: 'Scroll of Augmentation', type: 'item'},
    {id: 62, asset: 'Parchment of Augmentation', type: 'item'},
    {id: 63, asset: 'Big Totem of Energy', type: 'item'},
    {id: 64, asset: 'Mythic Continuum Relic', type: 'item'},
    {id: 65, asset: 'Royal Scepter of Transmutation', type: 'item'},
    {id: 66, asset: 'Gleaming Continuum Relic', type: 'item'},
    {id: 67, asset: 'Iron Ingot', type: 'item'},
    {id: 68, asset: 'Staff of Transmutation', type: 'item'},
    {id: 69, asset: 'Potion of Divine Enlightenment', type: 'item'}
]

/**
 * Event listeners for NFT contracts in KAIA Testnet.
 */
export const kaiaTestnetNFTListeners = () => {
    /**
     * Event listener for Wonderbits contract to listen to Transfer events for sales/purchases.
     * 
     * Excludes 0x0 from and to address as those are for minting/burning.
     */
    WONDERBITS_CONTRACT.on('Transfer', (from: string, to: string, tokenId: BigNumber, event: Event) => {
        console.log(`Transfer event fired for Wonderbits contract: ${from} -> ${to} with token ID: ${tokenId.toString()}`);

        console.log(`Event data: ${JSON.stringify(event, null, 2)}`);
    });

    /**
     * Event listener for Islands contract to listen to Transfer events for sales/purchases.
     * 
     * Excludes 0x0 from and to address as those are for minting/burning.
     */
    ISLANDS_CONTRACT.on('Transfer', (from: string, to: string, tokenId: BigNumber, event: Event) => {
        console.log(`Transfer event fired for Islands contract: ${from} -> ${to} with token ID: ${tokenId.toString()}`);

        console.log(`Event data: ${JSON.stringify(event, null, 2)}`);
    });

    /**
     * Event listener for Bit Cosmetics contract to listen to Transfer events for sales/purchases.
     * 
     * Excludes 0x0 from and to address as those are for minting/burning.
     */
    BIT_COSMETICS_CONTRACT.on('Transfer', (from: string, to: string, tokenId: BigNumber, event: Event) => {
        console.log(`Transfer event fired for Bit Cosmetics contract: ${from} -> ${to} with token ID: ${tokenId.toString()}`);

        console.log(`Event data: ${JSON.stringify(event, null, 2)}`);
    });
}