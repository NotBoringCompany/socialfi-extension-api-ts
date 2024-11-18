import { AssetBlockchainData, AssetOwnerData } from './asset';
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
    /** the owner data of this bit (current owner, original owner, etc.) */
    ownerData: AssetOwnerData;
    /** the blockchain data of this bit (if it's mintable, if it's already minted, the contract address, etc.) */
    blockchainData: AssetBlockchainData;
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
    /** the data for any equipped cosmetics for the bit */
    equippedCosmetics: EquippedCosmetics;
    /** farming stats of the bit, such as gathering rate and energy */
    farmingStats: BitFarmingStats;
    /** stat modifiers for the bit's farming stats */
    bitStatsModifiers: BitStatsModifiers;
}

/**
 * Represents the data of equipped bit cosmetics.
 */
export interface EquippedCosmetics {
    /** the data for the head (if any cosmetic is equipped) */
    head: EquippedCosmeticData;
    /** the data for the body (if any cosmetic is equipped) */
    body: EquippedCosmeticData;
    /** the data for the arms (if any cosmetic is equipped) */
    arms: EquippedCosmeticData;
    /** the data for the back (if any cosmetic is equipped) */
    back: EquippedCosmeticData;
}

/**
 * Represents the data of an equipped bit cosmetic.
 */
export interface EquippedCosmeticData {
    /** the id of the cosmetic. if none is equipped, this will be null. */
    cosmeticId: string | null;
    /** the name of the cosmetic. mostly required for frontend. if `cosmeticId` is null, this will also be null. */
    cosmeticName: string | null;
    /** when the cosmetic was equipped at. if none is equipped at the moment, this will be 0. */
    equippedAt: number;
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
 * a runtime-populated object representing all available bit traits.
 * each key is a unique trait name, and each value is the same trait name as a string, 
 * allowing it to behave similarly to a typescript enum.
 */
export const BitTraitEnum: { [key: string]: string } = {}
/**
 * represents the type of a bit trait key from `BitTraitEnum`, 
 * acting as a union of all valid cosmetic names once populated at runtime.
 * this allows `BitTrait` to behave similarly to an enum type.
 */
export type BitTrait = Extract<keyof typeof BitTraitEnum, string>;

/**
 * Represents the data of a Bit trait.
 */
export interface BitTraitData {
    /** the database ID of the bit trait data */
    _id?: string;
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
 * NOTE: the current gathering rate will NOT be added here due to complexity, but is available in `calcBitCurrentRate`.
 */
export interface BitFarmingStats {
    /** base gathering rate for the bit (at level 1), calculated at % of total resources/hour */
    baseGatheringRate: number;
    /** growth of base gathering rate when level increases, currently a fixed percentage */
    gatheringRateGrowth: number;
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
 * NOTE: Calculating the final gathering rates will be as follows:
 * current gathering rate * modifier 1 * modifier 2 and so on...
 */
export interface BitStatsModifiers {
    gatheringRateModifiers: Modifier[];
    energyRateModifiers: Modifier[];
    // energy replenishment after consuming food. > 1 means more energy is replenished and vice versa.
    foodConsumptionEfficiencyModifiers: Modifier[];
}

/**
 * Reductions in gathering rate when the bit's energy is lower than a certain amount.
 */
export interface EnergyThresholdReduction {
    /** the reduction in gathering rate (by a fixed %) */
    gatheringRateReduction: number;
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
