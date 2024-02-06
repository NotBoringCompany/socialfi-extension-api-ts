import { ObtainMethod } from './obtainMethod';

/****************
 * BIT-RELATED MODELS
 ****************/

/**
 * Represents a Bit.
 */
export interface Bit {
    /** unique id to distinguish the bit, starts from 1 */
    id: number;
    /** bit rarity */
    rarity: BitRarity;
    /** bit gender */
    gender: BitGender;
    /** owner of this bit; equates to the user's object ID in the database */
    owner: string;
    /** purchase date of this bit (currently limited to when it was obtained from the bit orb) */
    purchaseDate: number;
    /** method of obtaining the bit */
    obtainMethod: ObtainMethod;
    /** total cookies spent for the bit (excl. purchase price). when evolving, this number will increase */
    totalCookiesSpent: number;
    /** current level of the bit */
    currentLevel: number;
    /** farming stats of the bit, such as gathering rate, earning rate and energy */
    farmingStats: BitFarmingStats;
    /** stat modifiers for the bit's farming stats */
    bitStatsModifiers: BitStatsModifiers;
}

/**
 * Represents the rarity of a Bit.
 */
export enum BitRarity {
    COMMON = 'Common',
    UNCOMMON = 'Uncommon',
    RARE = 'Rare',
    EPIC = 'Epic',
    LEGENDARY = 'Legendary',
}

/**
 * Represents the gender of a Bit.
 */
export enum BitGender {
    MALE = 'Male',
    FEMALE = 'Female',
}