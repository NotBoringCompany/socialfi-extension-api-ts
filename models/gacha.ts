import { AssetType } from './asset';

/**
 * Represents a gacha roll to obtain an asset by luck.
 */
export interface GachaRoll {
    /** the gacha roll's database ID */
    _id: string;
    /** the name of the gacha roll */
    name: string;
    /** 
     * the number of rolls before a B tier asset is guaranteed to drop.
     * if this is `null`, then each roll will have the same base probability of obtaining a B tier asset.
     * 
     * NOTE: if the user obtains a B tier asset before `bThreshold` rolls, then the roll counter will reset back to `bThreshold`.
     */
    bThreshold: number | null;
    /**
     * similar to Genshin, a fortune surge acts like a soft pity between `fortuneSurgeThreshold` to `aThreshold` rolls, where the probability of obtaining an A tier asset increases with each roll from `fortuneSurgeThreshold` until it reaches `aThreshold` rolls, where an A tier asset is guaranteed to drop.
     * 
     * unlike `bThreshold`, `aThreshold` and `fortunePeakThreshold`, this value is not reset upon obtaining a guaranteed asset, because it's only used as a 'roll counter benchmark' to determine when the probability of obtaining an A tier asset should start increasing.
     */
    fortuneSurgeThreshold: number | null; 
    /**
     * the number of rolls before an A tier asset is guaranteed to drop.
     * if this is `null`, then each roll will have the same base probability of obtaining an A tier asset.
     * 
     * NOTE: if the user obtains an A tier asset before `aThreshold` rolls, then the roll counter will reset back to `aThreshold`.
     */
    aThreshold: number | null;
    /**
     * the number of rolls before a featured asset is guaranteed to drop (similar to a hard pity in Genshin).
     * if this is `null`, then each roll will have the same base probability of obtaining a featured asset.
     * 
     * NOTE: if the user obtains a featured asset before `fortunePeakThreshold` rolls, then:
     * 1. the `fortunePeakThreshold` counter will reset back to `fortunePeakThreshold`.
     * 2. the `aThreshold` counter will reset back to `aThreshold` (because featured assets are A tier).
     * 
     * if this gacha roll has no featured assets, then this value should be `null`, otherwise it will use the normal probability values to roll for any asset.
     */
    fortunePeakThreshold: number | null;
    /** 
     * the data of all assets that can be obtained from this gacha roll.
     * 
     * includes their asset type, their base probability units, and so on.
     */
    assetData: GachaRollAssetData[];
}

/**
 * Represents the data of an asset that can be obtained from a gacha roll.
 */
export interface GachaRollAssetData {
    /** the type of asset. used mostly to help simplify query logic. */
    assetType: 'item' | 'resource' | 'food' | 'igc';
    /** the actual asset */
    asset: AssetType;
    /** the image URL of the asset */
    imageUrl: string | null;
    /** 
     * the tier of the asset w.r.t the gacha roll.
     * 
     * NOTE: this is NOT the rarity of the asset itself. this is used to determine the rarity/tier category to place this asset in the gacha roll.
     */
    tier: GachaRollAssetTier;
    /**
     * if this asset is a featured drop in the gacha roll.
     * 
     * if `featured` is true and the gacha roll's `zRolls` is on (not null), then every Z rolls (as specified in the gacha roll's `zRolls`), a featured asset will be guaranteed to drop.
     * if there are more than one featured assets, the probability of obtaining one of them upon a Z roll depends on their individual probability weights. however, what's certain is that all featured assets will have a cumulative probability of 100%.
     * 
     * NOTE: only A tier assets can be featured, else the backend may throw errors.
     */
    featured: boolean;
    /** 
     * the weight used to determine the probability of obtaining this asset.
     * 
     * NOTE: this is NOT the direct percentage probability of obtaining this asset.
     * to determine the actual percentage probability, calculate the ratio of this value 
     * to the sum of all probability weights in the gacha roll.
     * 
     * for example, if the sum of all probability weights in the gacha roll is 1000, 
     * and this asset has a probability weight of 100, the actual percentage probability 
     * of obtaining this asset would be 100 / 1000 = 10%.
     */
    probabilityWeight: number;
}

/**
 * Represents the tier of an asset in a gacha roll.
 * 
 * A = highest tier, C = lowest tier.
 * 
 * NOTE: Featured assets will ALWAYS be in A tier.
 */
export enum GachaRollAssetTier {
    A = 'A',
    B = 'B',
    C = 'C',
}