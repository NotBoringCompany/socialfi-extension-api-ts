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

/// BASE URLS FOR APIS USED FOR WEB3 RELATED OPERATIONS (MAINLY PRICE FETCHING)
export const BINANCE_API_BASE_URL = `https://data-api.binance.vision`;
export const KUCOIN_API_BASE_URL = `https://api.kucoin.com`;
export const GATEIO_API_BASE_URL = `https://api.gateio.ws`;

/// TonWeb instance with API Key
export const TON_WEB = new TonWeb(new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC', { apiKey: '3c0a0f5f670a63999e7ce601c17872de2e557d425d373271d3bc1e0cd7517079'} ))

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

// wonderbits address in XProtocol testnet
export const WONDERBITS_CONTRACT_ADDRESS = process.env.WONDERBITS_CONTRACT!;

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
    DEPLOYER_WALLET(XPROTOCOL_TESTNET_PROVIDER)
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
    const wallet = new ethers.Wallet(privateKey, XPROTOCOL_TESTNET_PROVIDER);

    return new ethers.Contract(
        WONDERBITS_CONTRACT_ADDRESS,
        WONDERBITS_ARTIFACT.abi,
        wallet
    );
}