import { Modifier } from './modifier';
import { ObtainMethod } from './obtainMethod';
import { Resource } from './resource';

/****************
 * ISLAND-RELATED MODELS
 ****************/

/**
 * Represents an island.
 */
export interface Island {
    /** unique id to distinguish the island, starts from 1 */
    islandId: number;
    /** type of island; Raft is also included as an island type when the user has no island */
    type: IslandType;
    /** owner of this island; equates to the user's object ID in the database */
    owner: string;
    /** purchase date of this island (currently limited to when it was obtained from the terra cap) */
    purchaseDate: number;
    /** method of obtaining the island */
    obtainMethod: ObtainMethod;
    /** current level of the island */
    currentLevel: number;
    /** 
     * current tax for this particular island (resulting xCookies claimed will be reduced by this tax) 
     * 
     * please note that this will be updated just before claiming xCookies everytime.
     */
    currentTax: number;
    /** the IDs of the bits that are placed (tied down) into this island to gather and earn */
    placedBitIds: number[];
    /** 
     * 5 island traits for each resource rarity
     * e.g. if mineral rich, fertile, fertile, fertile, aquifer, then:
     * common = mineral rich, uncommon = fertile, rare = fertile, epic = fertile, legendary = aquifer
     * so if a common resource is gathered, it will drop a mineral rich resource for common rarity
     */
    trait: IslandTrait[];
    /** resource stats related to the island, such as gathering rate */
    islandResourceStats: IslandResourceStats;
    /** earning stats related to the island, such as earning rate */
    islandEarningStats: IslandEarningStats;
    /** modifiers for both resource and earning stats (incl. boost and reduction) */
    islandStatsModifiers: IslandStatsModifiers;
}

/**
 * Represents the type of island.
 */
export enum IslandType {
    // for free to play players, generating very small amount of (possibly common) resources
    BARREN = 'Barren',
    PRIMAL_ISLES = 'Primal Isles',
    VERDANT_ISLES = 'Verdant Isles',
    EXOTIC_ISLES = 'Exotic Isles',
    CRYSTAL_ISLES = 'Crystal Isles',
    CELESTIAL_ISLES = 'Celestial Isles',
}

/**
 * Represents the trait of an island.
 */
export enum IslandTrait {
    // produce mineral ores
    MINERAL_RICH = 'Mineral Rich',
    // produce fruits
    FERTILE = 'Fertile',
    // produce liquids
    AQUIFER = 'Aquifer',
}

/**
 * Represents the gathering and resource stats of an island.
 * 
 * Gathering rate will not be calculated here due to complexity.
 */
export interface IslandResourceStats {
    /** base amount of resources available to be gathered from this island, excluding deductions */
    baseResourceCap: number;
    /** total resources gathered, incl. ones claimed already */
    resourcesGathered: Resource[];
    /** gathered resources that are claimable but not claimed to the inventory yet (pending) */
    claimableResources: Resource[];
    /** start timestamp of gathering; 0 if not started yet */
    gatheringStart: number;
    /** end timestamp of gathering; 0 if not ended yet */
    gatheringEnd: number;
    /** timestamp of when `claimableResources` were last claimed */
    lastClaimed: number;
    /** gathering progress to gather 1 RESOURCE (not all resources); will be from 0 to 100
     * once progress goes > 100, it will gather 1 resource and reset back to 0 + any overflow of %
     * (UPDATED PER HOUR)
     */
    gatheringProgress: number;
}

/**
 * Represents the earning stats of an island.
 * 
 * Earning rate will not be calculated here due to complexity.
 */
export interface IslandEarningStats {
    /** total xCookies spent on this island (INCL. BITS!); will keep increasing when upgrading the island and bits placed inside */
    totalXCookiesSpent: number;
    /** total xCookies earned, incl. ones claimed already. end amount should equal total xCookies spent (even with tax since it's not calc. here) */
    totalXCookiesEarned: number;
    /** claimable xCookies that haven't been claimed yet to the inventory */
    claimableXCookies: number;
    /** total cookie crumbs earned, incl. the ones claimed already. */
    totalCookieCrumbsEarned: number;
    /** claimable cookie crumbs that haven't been claimed yet to the inventory */
    claimableCookieCrumbs: number;
    /** start timestamp of earning (xCookies); 0 if not started yet */
    earningStart: number;
    /**  start timestamp of earning (cookie crumbs); 0 if not started yet */
    crumbsEarningStart: number;
    /** end timestamp of earning (xCookies); 0 if not ended yet */
    earningEnd: number;
    /** end timestamp of earning (cookie crumbs); 0 if not ended yet */
    crumbsEarningEnd: number;
    /** timestamp of when `claimableXCookies` were last claimed */
    lastClaimed: number;
    /** timestamp of when `claimableCookieCrumbs` were last claimed */
    crumbsLastClaimed: number;
}

/** 
 * Represents the modifiers for both resource and earning stats.
 * 
 * NOTE: Calculating the final gathering and earning rates will be as follows:
 * current gathering/earning rate * modifier 1 * modifier 2 and so on... (same with resource cap)
 */
export interface IslandStatsModifiers {
    /** resource cap modifiers */
    resourceCapModifiers: Modifier[];
    /** gathering rate modifiers */
    gatheringRateModifiers: Modifier[];
    /** earning rate modifiers */
    earningRateModifiers: Modifier[];
}

/**
 * Represents the chances to drop each of the resources when gathering 1 resource from an island.
 *
 */
export interface ResourceDropChance {
    /** the chance to drop stone */
    stone: number;
    /** the chance to drop keratin */
    keratin: number;
    /** the chance to drop silver */
    silver: number;
    /** the chance to drop diamond */
    diamond: number;
    /** the chance to drop relic */
    relic: number;
}

/**
 * Represents the differences in resource drop chances when gathering 1 resource from an island as the island levels up.
 * 
 * Exact same as `ResourceDropChance`, but is used just to differentiate the two in the code.
 */
export interface ResourceDropChanceDiff extends ResourceDropChance {}

/**
 * Used to determine whether to calculate effective earning or gathering rates for both bit and island.
 */
export enum RateType {
    GATHERING = 'Gathering',
    EARNING = 'Earning',
}

export interface RarityDeviationReduction {
    /** the reduction in gathering rate (by a fixed %)  */
    gatheringRateReduction: number;
    /** the reduction in resource cap (by a fixed %) */
    resourceCapReduction: number;
}