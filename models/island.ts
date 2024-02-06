import { ObtainMethod } from './obtainMethod';

/****************
 * ISLAND-RELATED MODELS
 ****************/

/**
 * Represents an island.
 */
export interface Island {
    /** unique id to distinguish the island, starts from 1 */
    id: number;
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
    /** the bits that are placed (tied down) into this island to gather and earn */
    placedBits: Bit;
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
enum IslandType {
    RAFT = 'Raft',
    PRIMAL_ISLES = 'Primal Isles',
    VERDANT_ISLES = 'Verdant Isles',
    EXOTIC_ISLES = 'Exotic Isles',
    CRYSTAL_ISLES = 'Crystal Isles',
    CELESTIAL_ISLES = 'Celestial Isles',
}