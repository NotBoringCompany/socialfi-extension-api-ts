import { Modifier } from './modifier';
import { ObtainMethod } from './obtainMethod';

/****************
 * BIT-RELATED MODELS
 ****************/

/**
 * Represents a Bit.
 */
export interface Bit {
    /** unique id to distinguish the bit, starts from 1 */
    bitId: number;
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
    /** current farming level of the bit; pvx level will start from level 1 */
    currentFarmingLevel: number;
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

/**
 * Represents the farming stats of a Bit.
 */
export interface BitFarmingStats {
    /** base gathering rate for the bit (at level 1), calculated at % of total resources/hour */
    baseGatheringRate: number;
    /** growth of base gathering rate when level increases, currently a fixed percentage */
    gatheringRateGrowth: number;
    /** current gathering rate for the bit (at current level), incl. base gathering rate + gathering rate growth + bit stats modifiers + exp. decay */
    currentGatheringRate: number;
    /** base earning rate for the bit (at level 1), calculated at % of total cookies/hour */
    baseEarningRate: number;
    /** growth of base earning rate when level increases, currently a fixed percentage */
    earningRateGrowth: number;
    /** current earning rate for the bit (at current level), incl. base earning rate + earning rate growth + bit stats modifiers + exp. decay */
    currentEarningRate: number;
    /** 
     * current energy depletion rate for the bit (at level 1), calculated at % of total energy/hour 
     * 
     * NOTE: base energy depletion rate is always constant, see `BASE_ENERGY_DEPLETION_RATE`
     */
    currentEnergyDepletionRate: number;
    /** current energy of the bit */
    currentEnergy: number;
}

/**
 * Represents the stat modifiers for a Bit's farming stats.
 * 
 * NOTE: Calculating the final gathering and earning rates will be as follows:
 * current gathering/earning rate * modifier 1 * modifier 2 and so on...
 */
export interface BitStatsModifiers {
    gatheringRateModifiers: Modifier[];
    earningRateModifiers: Modifier[];
    energyRateModifiers: Modifier[];
}