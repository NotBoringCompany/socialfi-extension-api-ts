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