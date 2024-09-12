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
}