import { AssetBlockchainData, AssetOwnerData } from './asset';

/**
 * Represents a cosmetic item for a Bit (in the store).
 */
export interface BitCosmetic {
  /** the database ID of the cosmetic */
  _id: string;
  /** the name of the cosmetic */
  name: string;
  /** which set this cosmetic item belongs to */
  set: string;
  /** which part of the bit the cosmetic is applicable to */
  slot: BitCosmeticSlot;
  /** the rarity of the cosmetic */
  rarity: BitCosmeticRarity;
  /** the image URL of the cosmetic */
  imageUrl: string;
}

/**
 * Represents a BitCosmetic instance stored in a user's inventory, extends `BitCosmetic`.
 */
export interface BitCosmeticInventory extends BitCosmetic {
  /** the numerical ID of this cosmetic */
  bitCosmeticId: number;
  /** the owner data of the cosmetic (current owner, original owner, etc.) */
  ownerData: AssetOwnerData;
  /** the blockchain data of this cosmetic (current owner, original owner, etc.) */
  blockchainData: AssetBlockchainData;
}

/**
 * a runtime-populated object representing all available bit cosmetics. 
 * each key is a unique cosmetic name, and each value is the same cosmetic name as a string, 
 * allowing it to behave similarly to a typescript enum.
 */
export const BitCosmeticEnum: { [key: string]: string } = {}
/**
 * represents the type of a bit cosmetic key from `BitCosmeticEnum`, 
 * acting as a union of all valid cosmetic names once populated at runtime.
 * this allows `BitCosmeticType` to behave similarly to an enum type.
 */
export type BitCosmeticType = Extract<keyof typeof BitCosmeticEnum, string>;

/**
 * Represents the slot of a cosmetic item.
 */
export enum BitCosmeticSlot {
  HEAD = 'head',
  BODY = 'body',
  ARMS = 'arms',
  BACK = 'back'
}

/**
 * Lists all the possible rarities for a cosmetic item.
 */
export enum BitCosmeticRarity {
  COMMON = 'Common',
  UNCOMMON = 'Uncommon',
  RARE = 'Rare',
  EPIC = 'Epic',
  LEGENDARY = 'Legendary',
}

/**
 * Numeric representation of `BitCosmeticRarity`.
 */
export const BitCosmeticRarityNumeric: { [key in BitCosmeticRarity]: number } = {
  [BitCosmeticRarity.COMMON]: 0,
  [BitCosmeticRarity.UNCOMMON]: 1,
  [BitCosmeticRarity.RARE]: 2,
  [BitCosmeticRarity.EPIC]: 3,
  [BitCosmeticRarity.LEGENDARY]: 4,
}