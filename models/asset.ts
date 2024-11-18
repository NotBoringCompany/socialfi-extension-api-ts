import { BitCosmeticType } from './cosmetic';
import { CraftableAsset } from './craft';
import { FoodType } from './food';
import { ItemType } from './item';
import { ResourceType } from './resource';

/**
 * Represents the list of assets available in our game.
 */
export interface Asset {
    type: AssetType;
    description: string;
}

/**
 * AssetType represents the different types of assets in the game.
 * 
 * This includes resources, food, items, and other assets (essentially every single 'thing' in the game).
 */
export type AssetType = 
    ResourceType | FoodType | ItemType | CraftableAsset | BitCosmeticType;

/**
 * Represents the data of this asset's current and original owner and other owner-related data.
 */
export interface AssetOwnerData {
    /** the database ID of the current owner */
    currentOwnerId: string;
    /** the database ID of the original owner */
    originalOwnerId: string;
    /** the address of the current owner which holds this asset (if minted as an NFT; null otherwise) */
    currentOwnerAddress: string | null;
    /** 
     * if this asset is in custody. in custody means that the asset is held by a custodial contract.
     * 
     * this is done when the asset is minted as an NFT and the user wants to use it in-game, preventing discrepancy 
     * if the user decides to sell the NFT while it's still being used in-game.
     * 
     * if the asset has not been minted or is not in custody, this will be false.
     */
    inCustody: boolean;
    /** the address of the original owner which held this asset (if minted as an NFT; null otherwise) */
    originalOwnerAddress: string | null;
}

/**
 * Represents the blockchain data of an asset.
 */
export interface AssetBlockchainData {
    /** if the bit is mintable, this will be true */
    mintable: boolean;
    /** if the bit is already minted, this will be true */
    minted: boolean;
    /** the token id of the bit (if minted) */
    tokenId: number | null;
    /** the chain where this bit resides in (if minted) */
    chain: string | null;
    /** the contract address of the bit (if minted) */
    contractAddress: string | null;
    /** the transaction hash of the minting transaction (if minted) */
    mintHash: string | null;
}