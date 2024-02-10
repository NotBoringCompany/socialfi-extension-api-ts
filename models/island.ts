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
    /** current tax for this particular island (resulting cookies claimed will be reduced by this tax) */
    currentTax: number;
    /** the IDs of the bits that are placed (tied down) into this island to gather and earn */
    placedBitIds: number[];
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
    PRIMAL_ISLES = 'Primal Isles',
    VERDANT_ISLES = 'Verdant Isles',
    EXOTIC_ISLES = 'Exotic Isles',
    CRYSTAL_ISLES = 'Crystal Isles',
    CELESTIAL_ISLES = 'Celestial Isles',
}

/**
 * Represents the gathering and resource stats of an island.
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
    /** current gathering rate for resources in % of total resources/hour
     * (excl. boosts/modifiers but incl. base gathering rate + level modifiers from bits) 
     */
    currentGatheringRate: number;
    /** gathering progress to gather 1 RESOURCE (not all resources); will be from 0 to 100
     * once progress goes > 100, it will gather 1 resource and reset back to 0 + any overflow of %
     * (UPDATED PER HOUR)
     */
    gatheringProgress: number;
}

/**
 * Represents the earning stats of an island.
 */
export interface IslandEarningStats {
    /** total cookies spent on this island (INCL. BITS!); will keep increasing when upgrading the island and bits placed inside */
    totalCookiesSpent: number;
    /** total cookies earned, incl. ones claimed already. end amount should equal total cookies spent (even with tax since it's not calc. here) */
    totalCookiesEarned: number;
    /** claimable cookies that haven't been claimed yet to the inventory */
    claimableCookies: number;
    /** start timestamp of earning; 0 if not started yet */
    earningStart: number;
    /** end timestamp of earning; 0 if not ended yet */
    earningEnd: number;
    /** timestamp of when `claimableCookies` were last claimed */
    lastClaimed: number;
    /** the current earning rate for cookies in % of total cookies spent/hour
     * (excl. boosts/modifiers but incl. base earning rate + level modifiers from bits)
     */
    currentEarningRate: number;
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
 */
export interface DefaultResourceDropChance {
    silver: number;
    emerald: number;
    diamond: number;
    tanzanite: number;
    relic: number;
}
