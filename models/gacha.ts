import { AssetType } from './asset';
import { WonderspinTicketType } from './item';

/**
 * Represents a gacha roll to obtain an asset by luck.
 */
export interface Wonderspin {
    /** the Wonderspin's database ID */
    _id: string;
    /** the name of the Wonderspin */
    name: string;
    /** the type of ticket required to spin this Wonderspin */
    ticketType: WonderspinTicketType;
    /** if the wonderspin is able to be spun currently */
    active: boolean;
    /** 
     * the number of rolls before a B tier asset is guaranteed to drop.
     * if this is `null`, then each roll will have the same base probability of obtaining a B tier asset.
     */
    fortuneCrestThreshold: number | null;
    /**
     * similar to Genshin, a fortune surge acts like a soft pity between `fortuneSurgeThreshold` to `fortuneBlessingThreshold` rolls, where the probability of obtaining an A tier asset increases with each roll from `fortuneSurgeThreshold` until it reaches `fortuneBlessingThreshold` rolls, where an A tier asset is guaranteed to drop.
     */
    fortuneSurgeThreshold: number | null; 
    /**
     * the number of rolls before an A tier asset is guaranteed to drop (similar to a hard pity in Genshin).
     * if this is `null`, then each roll will have the same base probability of obtaining an A tier asset.
     */
    fortuneBlessingThreshold: number | null;
    /**
     * the number of rolls before a featured asset is guaranteed to drop (similar to a rate-up in Genshin).
     * if this is `null`, then each roll will have the same base probability of obtaining a featured asset.
     * 
     * if this Wonderspin has no featured assets, then this value should be `null`, otherwise it will use the normal probability values to roll for any asset.
     */
    fortunePeakThreshold: number | null;
    /** 
     * the data of all assets that can be obtained from this Wonderspin.
     * 
     * includes their asset type, their base probability units, and so on.
     */
    assetData: WonderspinAssetData[];
}

/**
 * Represents the data of an asset that can be obtained from a Wonderspin.
 */
export interface WonderspinAssetData {
    /** the type of asset. used mostly to help simplify query logic. */
    assetType: 'item' | 'resource' | 'food' | 'igc';
    /** the actual asset */
    asset: AssetType | 'diamonds' | 'xCookies';
    /** the amount of this asset to be obtained if rolled */
    amount: number;
    /** the image URL of the asset */
    imageUrl: string | null;
    /** 
     * the tier of the asset w.r.t the Wonderspin.
     * 
     * NOTE: this is NOT the rarity of the asset itself. this is used to determine the rarity/tier category to place this asset in the Wonderspin.
     */
    tier: WonderspinAssetTier;
    /**
     * if this asset is a featured drop in the Wonderspin.
     * 
     * if `featured` is true and the Wonderspin's `fortunePeakThreshold` is not `null`, then a featured asset (this or other featured assets) is guaranteed to drop after `fortunePeakThreshold` rolls.
     * if this Wonderspin has more than one featured asset, the probability to obtain any of them depends on their individual probability weights.
     * 
     * NOTE: only A tier assets can be featured, else the backend may throw errors.
     */
    featured: boolean;
    /** 
     * the weight used to determine the probability of obtaining this asset.
     * 
     * NOTE: this is NOT the direct percentage probability of obtaining this asset.
     * to determine the actual percentage probability, calculate the ratio of this value 
     * to the sum of all probability weights in the Wonderspin.
     * 
     * for example, if the sum of all probability weights in the Wonderspin is 1000, 
     * and this asset has a probability weight of 100, the actual percentage probability 
     * of obtaining this asset would be 100 / 1000 = 10%.
     */
    probabilityWeight: number;
}

/**
 * Represents the tier of an asset in a Wonderspin.
 * 
 * A = highest tier, C = lowest tier.
 * 
 * NOTE: Featured assets will ALWAYS be in A tier.
 */
export enum WonderspinAssetTier {
    A = 'A',
    B = 'B',
    C = 'C',
}

/**
 * Represents a user's data per Wonderspin instance/type.
 * 
 * For instance, say that there are 3 different Wonderspins in the game:
 * 1. Wonderspin A
 * 2. Wonderspin B
 * 3. Wonderspin C
 * 
 * all of the rolls done in Wonderspin A, for example, will be recorded within 1 `UserWonderspinData` object. another one for Wonderspin B, and so on.
 */
export interface UserWonderspinData {
    /** the database ID for this roll data */
    _id: string;
    /** the user's database ID */
    userId: string;
    /** the Wonderspin's ID */
    wonderspinId: string;
    /** the number of rolls done in this Wonderspin */
    totalRolls: number;
    /** 
     * how many rolls until `fortuneCrestThreshold` for this Wonderspin is reached and at least a B tier asset is guaranteed to drop on the next roll.
     * 
     * if `fortuneCrestThreshold` is `null`, this value will be `null` as well.
     * 
     * NOTE: if the user obtains a B tier asset before `fortuneCrestThreshold` rolls, then the roll counter will reset back to `fortuneCrestThreshold`.
     */
    rollsUntilFortuneCrest: number | null;
    /**
     * how many rolls until `fortuneSurgeThreshold` for this Wonderspin is reached and the probability of obtaining an A tier asset increases with each roll until it reaches `fortuneBlessingThreshold` rolls, where an A tier asset is guaranteed to drop.
     * 
     * if `fortuneSurgeThreshold` is `null`, this value will be `null` as well.
     */
    rollsUntilFortuneSurge: number | null;
    /**
     * when `rollsUntilFortuneSurge` reaches 0, the next roll will increase this value by 1 until an A tier asset is guaranteed to drop, which will reset this back to 0.
     * 
     * this is used to calculate the probability of obtaining an A tier asset on the next roll. the higher this value, the higher the probability of obtaining an A tier asset.
     * 
     * the formula to calculate the surged probability of obtaining an A tier asset (denotation: SPa) with the current fortune surge roll is:
     * BPa + ((100 - BPa) / (fortuneBlessingThreshold - fortuneSurgeThreshold) * currentFortuneSurgeRoll), where BPa = base probability of obtaining an A tier asset (calculated by obtaining the cumulative probability of all A tier assets in the Wonderspin).
     * 
     * for example, say BPa is 10%, `fortuneSurgeThreshold` is 50, and `fortuneBlessingThreshold` is 60. if the user has reached 50 rolls, the next roll will have the `currentFortuneSurgeRoll` as 1.
     * this means that the new FPa is 10 + ((100 - 10) / (60 - 50) * 1) = 19%. therefore, the user has a 19% chance of obtaining an A tier asset on the next roll.
     * 
     * NOTE: the max value of this should be the difference between `fortuneBlessingThreshold` and `fortuneSurgeThreshold`.
     * 
     * if `rollsUntilFortuneSurge` is `null`, this value will remain as 0.
     */
    currentFortuneSurgeRoll: number;
    /** 
     * how many rolls until `fortuneBlessingThreshold` for this Wonderspin is reached and at least an A tier asset is guaranteed to drop on the next roll.
     * 
     * if `fortuneBlessingThreshold` is `null`, this value will be `null` as well.
     * 
     * NOTE: if the user obtains an A tier asset before `fortuneBlessingThreshold` rolls, then the roll counter will reset back to `fortuneBlessingThreshold`.
     */
    rollsUntilFortuneBlessing: number | null;
    /** 
     * how many rolls until `fortunePeakThreshold` for this Wonderspin is reached and a featured asset is guaranteed to drop on the next roll.
     * 
     * if `fortunePeakThreshold` is `null`, this value will be `null` as well.
     * 
     * if the user obtains a featured asset before `fortunePeakThreshold` rolls, then:
     * 1. the `rollsUntilFortunePeak` counter will reset back to `fortunePeakThreshold`.
     * 2. the `rollsUntilFortuneBlessing` counter will reset back to `fortuneBlessingThreshold` (because featured assets are A tier).
     * 3. the `rollsUntilFortuneSurge` counter will reset back to `fortuneSurgeThreshold` (because the user has obtained an A tier asset).
     * 4. the `currentFortuneSurgeRoll` counter will reset back to 0 (because the user has obtained an A tier asset).
     * 
     * NOTE: obtaining A tier assets before `fortunePeakThreshold` rolls will NOT reset the `rollsUntilFortunePeak` counter, because this counter is only for featured assets.
     */
    rollsUntilFortunePeak: number | null;
}