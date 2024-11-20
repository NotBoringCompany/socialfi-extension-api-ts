import { POIName } from './poi';

/**
 * Represents the user's mastery in tapping.
 */
export interface TappingMastery {
    level: number;
    totalExp: number;
    rerollCount: number;
}

/**
 * Represents the user's mastery in crafting.
 */
// export interface CraftingMastery extends Record<CraftingRecipeLine, CraftingMasteryStats> {}

/**
 * Represents the stats for a specific crafting mastery.
 */
// export interface CraftingMasteryStats {
//     /** the level of a specific crafting mastery */
//     level: number;
//     /** the total experience points of a specific crafting mastery */
//     xp: number;
//     /** 
//      * the number of crafting slots for this particular line that the user owns. 
//      * 
//      * for example, if the user has 2 crafting slots, they can craft 2 assets at the same time, each in a different slot.
//      * the amount of an asset that can be crafted within a slot is determined by `craftablePerSlot`.
//      */
//     craftingSlots: number;
//     /**
//      * the amount of an asset craftable per slot.
//      * 
//      * for example, if `craftablePerSlot` is 10, then a user can craft 10 of an asset per slot.
//      */
//     craftablePerSlot: number;
// }

/**
 * Represents the user's mastery for a Berry Factory in each POI.
 */
export interface BerryFactoryMastery extends Record<POIName, BerryFactoryMasteryStats> {}

/**
 * Represents the stats for a specific berry factory mastery.
 */
export interface BerryFactoryMasteryStats {
    /** the level for this specific berry factory */
    level: number;
    /** total experience points for BerryFactoryMasteryStats */
    totalExp: number;
}