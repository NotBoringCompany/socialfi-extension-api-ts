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
export interface CraftingMastery {
    /**
     * Anything clothes/accessories related.
     */
    tailoring: CraftingMasteryStats;
    /**
     * Anything food related.
     */
    cooking: CraftingMasteryStats;
    /**
     * Anything weapon/armor/tools related.
     */
    blacksmithing: CraftingMasteryStats;
    /**
     * Anything refining/purification of ore resources related
     */
    smelting: CraftingMasteryStats;
    /**
     * Anything consumables/basic assets related.
     */
    synthesizing: CraftingMasteryStats;
}

/**
 * Represents the stats for a specific crafting mastery.
 */
export interface CraftingMasteryStats {
    /** the level of a specific crafting mastery */
    level: number;
    /** the total experience points of a specific crafting mastery */
    xp: number;
    /** 
     * the number of crafting slots for this particular line that the user owns. 
     * 
     * for example, if the user has 2 crafting slots, they can craft 2 assets at the same time, each in a different slot.
     * the amount of an asset that can be crafted within a slot is determined by `craftablePerSlot`.
     */
    craftingSlots: number;
    /**
     * the amount of an asset craftable per slot.
     * 
     * for example, if `craftablePerSlot` is 10, then a user can craft 10 of an asset per slot.
     */
    craftablePerSlot: number;
}