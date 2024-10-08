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
    /** the bit's name data */
    bitNameData: BitNameData;
    /** bit type */
    bitType: BitType;
    /** bit rarity */
    rarity: BitRarity;
    /** bit gender */
    gender: BitGender;
    /** if this bit is a premium bit or not (premium will allow them to be placed in non-barren islands.) */
    premium: boolean;
    /** owner of this bit; equates to the user's object ID in the database */
    owner: string;
    /** purchase date of this bit (currently limited to when it was obtained from the bit orb) */
    purchaseDate: number;
    /** method of obtaining the bit */
    obtainMethod: ObtainMethod;
    /** if the bit is placed in an island, the island ID will be shown here. If not, this will be 0. */
    placedIslandId: number;
    /** if the bit was relocated from a raft or an island, the relocation timestamp will be shown here to prevent constant relocation (cooldown). */
    lastRelocationTimestamp: number;
    /** current farming level of the bit; pvx level will start from level 1 */
    currentFarmingLevel: number;
    /** the bit's traits (up to 5 depending on rarity) */
    traits: BitTraitData[];
    /** farming stats of the bit, such as gathering rate, earning rate and energy */
    farmingStats: BitFarmingStats;
    /** stat modifiers for the bit's farming stats */
    bitStatsModifiers: BitStatsModifiers;
}

/**
 * Represents the data of a Bit name.
 */
export interface BitNameData {
    /** the bit's name */
    name: string;
    /** when the name was last changed */
    lastChanged: number;
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

/** Numeric representation of `BitRarity` */
export const BitRarityNumeric: { [key in BitRarity]: number } = {
    [BitRarity.COMMON]: 0,
    [BitRarity.UNCOMMON]: 1,
    [BitRarity.RARE]: 2,
    [BitRarity.EPIC]: 3,
    [BitRarity.LEGENDARY]: 4
}

/**
 * Lists all possible traits a Bit can have.
 */
export enum BitTrait {
    PRODUCTIVE = 'Productive',
    ENTHUSIASTIC = 'Enthusiastic',
    LAZY = 'Lazy',
    UNINSPIRED = 'Uninspired',
    TEAMWORKER = 'Teamworker',
    LEADER = 'Leader',
    CUTE = 'Cute',
    LONEWOLF = 'Lonewolf',
    QUICK = 'Quick',
    SLOW = 'Slow',
    GENIUS = 'Genius',
    FAMOUS = 'Famous',
    MANNERLESS = 'Mannerless',
    INFLUENTIAL = 'Influential',
    ANTAGONISTIC = 'Antagonistic',
    FIT = 'Fit',
    OBESE = 'Obese',
    STRONG = 'Strong',
    WEAK = 'Weak',
    FRUGAL = 'Frugal',
    HUNGRY = 'Hungry',
    LUCKY = 'Lucky',
    UNLUCKY = 'Unlucky',
    TRICKSTER = 'Trickster',
    HAPLESS = 'Hapless',
}

/**
 * Represents the data of a Bit trait.
 */
export interface BitTraitData {
    /** the trait name */
    trait: BitTrait;
    /** the trait's effect */
    effect: string;
    /** the trait's rarity */
    rarity: BitTraitRarity;
    /** the trait's category */
    category: BitTraitCategory;
    /** the trait's subcategory */
    subcategory: BitTraitSubCategory;
}

/**
 * Represents the rarity of a Bit trait.
 */
export enum BitTraitRarity {
    COMMON = 'Common',
    UNCOMMON = 'Uncommon',
    RARE = 'Rare',
}

/**
 * Lists all possible categories a Bit trait can belong to.
 */
export enum BitTraitCategory {
    WORKRATE_A = 'Workrate A',
    WORKRATE_B = 'Workrate B',
    WORKRATE_C = 'Workrate C',
    WORKRATE_D = 'Workrate D',
    ENERGY = 'Energy',
    FOOD_CONSUMPTION = 'Food Consumption',
    BONUS_RESOURCE = 'Bonus Resource',
    BREEDING = 'Breeding',
}

/**
 * Represents the subcategory of a Bit trait.
 * 
 * Positive means that the trait will have a positive effect on modifiers.
 * Negative means that the trait will have a negative effect on modifiers.
 */
export enum BitTraitSubCategory {
    POSITIVE = 'Positive',
    NEGATIVE = 'Negative',
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
 * 
 * NOTE: the current gathering and earning rates will NOT be added here due to complexity, but is available in `calcBitCurrentRate`.
 */
export interface BitFarmingStats {
    /** base gathering rate for the bit (at level 1), calculated at % of total resources/hour */
    baseGatheringRate: number;
    /** growth of base gathering rate when level increases, currently a fixed percentage */
    gatheringRateGrowth: number;
    /** base earning rate for the bit (at level 1), calculated at % of total xCookies/hour */
    baseEarningRate: number;
    /** growth of base earning rate when level increases, currently a fixed percentage */
    earningRateGrowth: number;
    /** 
     * current energy depletion rate for the bit, calculated at % of total energy/hour (+- 25% of the base energy depletion rate, which is 0.1% of total energy/hour)
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
    // energy replenishment after consuming food. > 1 means more energy is replenished and vice versa.
    foodConsumptionEfficiencyModifiers: Modifier[];
}

/**
 * Reductions in gathering rate and earning rate when the bit's energy is lower than a certain amount.
 */
export interface EnergyThresholdReduction {
    /** the reduction in gathering rate (by a fixed %) */
    gatheringRateReduction: number;
    /** the reduction in earning rate (by a fixed %) */
    earningRateReduction: number;
}

/**
 * Represents the type of a Bit.
 */
export enum BitType {
    MIBIT = 'Mibit',
    HOWLBIT = 'Howlbit',
    CUBIT = 'Cubit',
    BIBIT = 'Bibit',
    ZEBIT = 'Zebit',
    // only users from xterio can obtain this bit
    XTERIO = 'Xterio',
}
