import { Modifier } from './modifier';
import { ObtainMethod } from './obtainMethod';
import { ExtendedResource, Resource } from './resource';

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
    // /** the owner data of this island (current owner, original owner, etc.) */
    // ownerData: IslandOwnerData;
    // /** the blockchain data of this bit (if it's mintable, if it's already minted, the contract address, etc.) */
    // blockchainData: IslandBlockchainData;
    /** purchase date of this island (currently limited to when it was obtained from the terra cap) */
    purchaseDate: number;
    /** method of obtaining the island */
    obtainMethod: ObtainMethod;
    /** current level of the island */
    currentLevel: number;
    /** the IDs of the bits that are placed (tied down) into this island to gather and earn */
    placedBitIds: number[];
    /** 
     * 5 island traits for each resource rarity
     * e.g. if mineral rich, fertile, fertile, fertile, aquifer, then:
     * common = mineral rich, uncommon = fertile, rare = fertile, epic = fertile, legendary = aquifer
     * so if a common resource is gathered, it will drop a mineral rich resource of common rarity
     */
    traits: IslandTrait[];
    /** resource stats related to the island, such as gathering rate */
    islandResourceStats: IslandResourceStats;
    /** modifiers for both resource and earning stats (incl. boost and reduction) */
    islandStatsModifiers: IslandStatsModifiers;
    /** island tapping related data */
    islandTappingData: IslandTappingData;
}

// /**
//  * Represents the data of this island's current and original owner and other owner-related data.
//  */
// export interface IslandOwnerData {
//     /** the database ID of the current owner */
//     currentOwnerId: string;
//     /** the database ID of the original owner */
//     originalOwnerId: string;
//     /** the address of the current owner which holds this asset (if minted as an NFT; null otherwise) */
//     currentOwnerAddress: string | null;
//     /** the address of the original owner which held this asset (if minted as an NFT; null otherwise) */
//     originalOwnerAddress: string | null;
// }

// /**
//  * Represents the blockchain data of this island.
//  */
// export interface IslandBlockchainData {
//     /** if the island is mintable as an NFT */
//     mintable: boolean;
//     /** if the island is already minted as an NFT */
//     minted: boolean;
//     /** the token ID of the island (if minted as an NFT; null otherwise) */
//     tokenId: string | null;
//     /** the contract address of the island (if minted as an NFT; null otherwise) */
//     contractAddress: string | null;
//     /** the transaction hash of the minting transaction (if minted as an NFT; null otherwise) */
//     txHash: string | null;
// }

/**
 * Represents the type of island.
 */
export enum IslandType {
    PRIMAL_ISLES = 'Primal Isles',
    VERDANT_ISLES = 'Verdant Isles',
    EXOTIC_ISLES = 'Exotic Isles',
    CRYSTAL_ISLES = 'Crystal Isles',
    CELESTIAL_ISLES = 'Celestial Isles',
    // similar stats as exotic isles, standalone type for Xterio users.
    XTERIO_ISLES = 'Xterio Isles',
}

/** Numeric representation of `IslandType` (numerical instance for rarity comparison) */
export const IslandRarityNumeric: { [key in IslandType]: number } = {
    [IslandType.PRIMAL_ISLES]: 0,
    [IslandType.VERDANT_ISLES]: 1,
    [IslandType.EXOTIC_ISLES]: 2,
    // xterio isles = exotic isles in terms of rarity
    [IslandType.XTERIO_ISLES]: 2,
    [IslandType.CRYSTAL_ISLES]: 3,
    [IslandType.CELESTIAL_ISLES]: 4
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
    resourcesGathered: ExtendedResource[];
    /** 
     * the amount of bonus resources gathered this day (each resource drop grants the user a chance to drop a bonus resource). 
     * value resets to 0 every day (23:59 UTC); there is a limit as to how many bonus resources can be gathered.
     */
    dailyBonusResourcesGathered: number;
    /** gathered resources that are claimable but not claimed to the inventory yet (pending) */
    claimableResources: ExtendedResource[];
    /** start timestamp of gathering; 0 if not started yet */
    gatheringStart: number;
    /** end timestamp of gathering; 0 if not ended yet */
    gatheringEnd: number;
    /** timestamp of when `claimableResources` were last claimed */
    lastClaimed: number;
    /** gathering progress to gather 1 RESOURCE (not all resources); will be from 0 to 100
     * once progress goes > 100, it will gather 1 resource and reset back to 0 + any overflow of %
     * (UPDATED PER 10 MINS)
     */
    gatheringProgress: number;
    /**
     *  when the gathering progress was last updated 
     * 
     *  since the frontend can call `gatheringProgress` to drop a resource once it reaches 100%, we add this
     *  to prevent users from faking the gathering progress increase by updating the value in the frontend.
     */
    lastUpdatedGatheringProgress: number;
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
}

/**
 * Represents the chances to drop a resource of a specific rarity of a specific line.
 * 
 * For example, if the number within `uncommon` hits, then an uncommon resource of a specific line (depending on the island's trait for an uncommon resource) will be dropped.
 */
export interface ResourceDropChance {
    /** chance to drop a common resource of a specific line */
    common: number;
    /** chance to drop an uncommon resource of a specific line */
    uncommon: number;
    /** chance to drop a rare resource of a specific line */
    rare: number;
    /** chance to drop an epic resource of a specific line */
    epic: number;
    /** chance to drop a legendary resource of a specific line */
    legendary: number;
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
}

/**
 * Used for Island Tapping mechanic
 */
export interface IslandTappingData {
    /** current tapping milestone progress */
    currentMilestone: number;
    /** booster reward when reaching current tapping milestone */
    milestoneReward: TappingMilestoneReward;
    /** caress energy meter required to apply current tapping milestone effect */
    caressEnergyMeter: number;
    /** current caress energy meter data */
    currentCaressEnergyMeter: number;
}

export interface TappingMilestoneReward {
    boosterReward: number;
    masteryExpReward: number;
    bonusReward: TappingMilestoneBonusReward;
}

export interface TappingMilestoneBonusReward {
    // First option reward will be Tapping Mastery Exp
    firstOptionReward: number;
    // Second option reward will be either Additional Exp, Currency Drop, or Point Drop
    secondOptionReward: {
        additionalExp?: number;
        berryDrop?: number;
        pointDrop?: number;
    }
}