import Bull from 'bull';
import { AssetType } from '../../models/asset';
import { CraftedAssetData, CraftedAssetRarity, CraftingQueueStatus, CraftingRecipe, CraftingRecipeLine } from "../../models/craft";
import { ContinuumRelicItem, EnergyTotemItem, IngotItem, Item, PotionItem, AugmentationItem, TransmutationItem, WonderArtefactItem, PotionEnum, EnergyTotemEnum, TransmutationEnum, AugmentationEnum, ContinuumRelicEnum, IngotEnum } from '../../models/item';
import { BarrenResource, CombinedResources, ExtendedResource, FruitResource, LiquidResource, OreResource, ResourceRarity, ResourceType, SimplifiedResource } from "../../models/resource";
import { FoodType } from '../../models/food';
import { CraftingQueueModel, CraftingRecipeModel, UserModel } from './db';
import { resources } from './resource';
import { POIName } from '../../models/poi';
import { generateObjectId } from '../crypto';
import { IslandType } from '../../models/island';
import { BitRarity } from '../../models/bit';
import { CraftingMastery, CraftingMasteryStats } from '../../models/mastery';

/**
 * this is the base amount of crafting slots users get per crafting line.
 */
export const BASE_CRAFTING_SLOTS = 1;
/**
 * this is the base amount of the craftable amount of an asset per crafting slot.
 */
export const BASE_CRAFTABLE_PER_SLOT = 10;

/**
 * this is the base amount of the craftable amount of an asset per crafting slot for smelting only.
 */
export const BASE_CRAFTABLE_PER_SLOT_SMELTING = 50;

// the required energy costs to craft a specific rarity of craftable assets.
export const BASE_ENERGY_COST_COMMON = 50;
export const BASE_ENERGY_COST_UNCOMMON = 100;
export const BASE_ENERGY_COST_RARE = 150;
export const BASE_ENERGY_COST_EPIC = 250;
export const BASE_ENERGY_COST_LEGENDARY = 400;

// the required energy costs to craft a specific rarity of INGOT ITEMS.
export const BASE_ENERGY_COST_COMMON_INGOT = 5;
export const BASE_ENERGY_COST_UNCOMMON_INGOT = 10;
export const BASE_ENERGY_COST_RARE_INGOT = 15;
export const BASE_ENERGY_COST_EPIC_INGOT = 25;
export const BASE_ENERGY_COST_LEGENDARY_INGOT = 40;

// the base crafting duration to craft a specific rarity of craftable assets.
export const BASE_CRAFTING_DURATION_COMMON = 60;
export const BASE_CRAFTING_DURATION_UNCOMMON = 600;
export const BASE_CRAFTING_DURATION_RARE = 14400;
export const BASE_CRAFTING_DURATION_EPIC = 43200;
export const BASE_CRAFTING_DURATION_LEGENDARY = 86400;

// the base crafting duration to craft a specific rarity of INGOT ITEMS.
export const BASE_CRAFTING_DURATION_COMMON_INGOT = 5;
export const BASE_CRAFTING_DURATION_UNCOMMON_INGOT = 15;
export const BASE_CRAFTING_DURATION_RARE_INGOT = 30;
export const BASE_CRAFTING_DURATION_EPIC_INGOT = 60;

// the required crafting level to craft a specific rarity of craftable assets.
export const REQUIRED_CRAFTING_LEVEL_COMMON = 1;
export const REQUIRED_CRAFTING_LEVEL_UNCOMMON = 1;
export const REQUIRED_CRAFTING_LEVEL_RARE = 1;
export const REQUIRED_CRAFTING_LEVEL_EPIC = 2;
export const REQUIRED_CRAFTING_LEVEL_LEGENDARY = 3;

// the amount of XP earned upon crafting a specific rarity of craftable assets.
export const EARNED_XP_COMMON = 50;
export const EARNED_XP_UNCOMMON = 100;
export const EARNED_XP_RARE = 300;
export const EARNED_XP_EPIC = 600;
export const EARNED_XP_LEGENDARY = 1000;

// the amount of XP earned upon crafting a specific rarity of INGOT ITEMS.
export const EARNED_XP_COMMON_INGOT = 2.5;
export const EARNED_XP_UNCOMMON_INGOT = 5;
export const EARNED_XP_RARE_INGOT = 15;
export const EARNED_XP_EPIC_INGOT = 30;
export const EARNED_XP_LEGENDARY_INGOT = 50;

/**
 * Defines the base XP required for each level in different Crafting Lines/Professions.
 * Each index in the array represents the XP required for the corresponding level.
 * For example:
 * - Index 0: Level 0 (no XP required)
 * - Index 1: Level 1 (250 XP required)
 * - Index 2: Level 2 (250 XP required), and so on.
 */
export const PROFESSION_BASE_REQUIRED_XP: Record<CraftingRecipeLine, number[]> = {
    [CraftingRecipeLine.CRAFTSMAN]: [0, 250, 550, 850, 1150, 1500, 2250, 3000, 3750, 4500, 5000, 5000, 5000, 5000, 5000],
    [CraftingRecipeLine.SYNTHESIZING]: [0, 500, 1100, 1700, 2300, 3000, 4500, 6000, 7500, 9000, 10000, 10000, 10000, 10000, 10000],
    [CraftingRecipeLine.ALCHEMY]: [0, 500, 1100, 1700, 2300, 3000, 4500, 6000, 7500, 9000, 10000, 10000, 10000, 10000, 10000],
    [CraftingRecipeLine.CARPENTRY]: [0, 500, 1100, 1700, 2300, 3000, 4500, 6000, 7500, 9000, 10000, 10000, 10000, 10000, 10000],
    [CraftingRecipeLine.BLACKSMITHING]: [0, 500, 1100, 1700, 2300, 3000, 4500, 6000, 7500, 9000, 10000, 10000, 10000, 10000, 10000],
    [CraftingRecipeLine.JEWELER]: [0, 500, 1100, 1700, 2300, 3000, 4500, 6000, 7500, 9000, 10000, 10000, 10000, 10000, 10000],
}

/**
 * Creates a new Bull instance for crafting assets to be queued.
 */
export const CRAFT_QUEUE = new Bull('craftQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Each time a crafting queue is complete, process the queue and increment the `claimData.claimableAmount` by 1.
 * This is to allow users to claim their crafted assets each time a crafting queue is complete.
 * 
 * Furthermore, update the `status` of the crafting queue from 'ONGOING' to 'CLAIMABLE'.
 */
CRAFT_QUEUE.process('completeCraft', async (job) => {
    const { craftingQueueId } = job.data;

    try {
        // increment `claimData.claimableAmount` by 1 and update the status of the crafting queue to 'CLAIMABLE'.
        const craftingQueue = await CraftingQueueModel.findOneAndUpdate(
            { _id: craftingQueueId },
            {
                $inc: { 'claimData.claimableAmount': 1 },
                status: CraftingQueueStatus.CLAIMABLE
            },
            { new: true }
        );

        // check if the `craftingQueue` instance is modified.
        if (!craftingQueue) {
            console.error(`(CRAFT_QUEUE, completeCraft) craftingQueue ${craftingQueueId} not found.`);
            return;
        }

        console.log(`(CRAFT_QUEUE, completeCraft) CraftingQueue ${craftingQueueId} updated.`);
    } catch (err: any) {
        console.error(`(CRAFT_QUEUE, completeCraft) Error processing crafting queue for CraftingQueue ${craftingQueueId}: ${err.message}`);
    }
});

/**
 * Gets the cost in xCookies to cancel a pending crafting queue.
 */
export const CANCEL_CRAFT_X_COOKIES_COST = (craftedAssetRarity: CraftedAssetRarity): number => {
    switch (craftedAssetRarity) {
        case CraftedAssetRarity.COMMON:
            return 2;
        case CraftedAssetRarity.UNCOMMON:
            return 5;
        case CraftedAssetRarity.RARE:
            return 15;
        case CraftedAssetRarity.EPIC:
            return 30;
        case CraftedAssetRarity.LEGENDARY:
            return 50;
        default:
            throw new Error(`(CANCEL_CRAFT_X_COOKIES_COST) Crafted asset rarity ${craftedAssetRarity} not found.`);

    }
}

/**
 * Gets the required POI the user needs to be in in order to craft or claim an asset of a specific crafting line.
 */
export const REQUIRED_POI_FOR_CRAFTING_LINE = (craftingRecipeLine: CraftingRecipeLine): POIName => {
    switch (craftingRecipeLine) {
        case CraftingRecipeLine.CRAFTSMAN:
            return POIName.HOME;
        case CraftingRecipeLine.SYNTHESIZING:
        case CraftingRecipeLine.ALCHEMY:
        case CraftingRecipeLine.CARPENTRY:
        case CraftingRecipeLine.BLACKSMITHING:
            return POIName.EVERGREEN_VILLAGE;
        case CraftingRecipeLine.JEWELER:
            return POIName.PALMSHADE_VILLAGE;
        // by default just throw an error
        default:
            throw new Error(`(REQUIRED_POI_FOR_CRAFTING_LINE) Crafting line ${craftingRecipeLine} not implemented yet or not found.`);
    }
}

/**
 * Retrieves the required XP multiplier for each level in a given crafting profession.
 * Each index in the returned array represents the multiplier for the corresponding level.
 * 
 * Example:
 * - Index 0: Base multiplier for level 1 (1.0)
 * - Index 1: Multiplier for level 2
 * - Index 2: Multiplier for level 3, and so on.
 * 
 * @param line - The target crafting profession (CraftingRecipeLine).
 * @returns A record mapping each crafting profession to an array of XP multipliers by level.
 */
export const GET_PROFESSION_REQUIRED_XP_MULTIPLIER = (line: CraftingRecipeLine): Record<CraftingRecipeLine, number[]> => {
    // return the fondation profession XP multiplier if the profession is Craftsman
    if (line === CraftingRecipeLine.CRAFTSMAN) {
        return {
            [CraftingRecipeLine.CRAFTSMAN]: [0, 2.0, 2.0, 2.0, 2.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
            [CraftingRecipeLine.SYNTHESIZING]: [0, 2.0, 2.0, 2.0, 2.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
            [CraftingRecipeLine.ALCHEMY]: [0, 2.0, 2.0, 2.0, 2.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
            [CraftingRecipeLine.CARPENTRY]: [0, 2.0, 2.0, 2.0, 2.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
            [CraftingRecipeLine.BLACKSMITHING]: [0, 2.0, 2.0, 2.0, 2.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
            [CraftingRecipeLine.JEWELER]: [0, 2.0, 2.0, 2.0, 2.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
        };
    }

    return {
        [CraftingRecipeLine.CRAFTSMAN]: [0, 2.0, 2.0, 2.0, 2.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
        [CraftingRecipeLine.SYNTHESIZING]: [0, 2.5, 2.5, 2.5, 2.5, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0],
        [CraftingRecipeLine.ALCHEMY]: [0, 2.5, 2.5, 2.5, 2.5, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0],
        [CraftingRecipeLine.CARPENTRY]: [0, 2.5, 2.5, 2.5, 2.5, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0],
        [CraftingRecipeLine.BLACKSMITHING]: [0, 2.5, 2.5, 2.5, 2.5, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0],
        [CraftingRecipeLine.JEWELER]: [0, 2.5, 2.5, 2.5, 2.5, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0],
    };
};

/**
 * Retrieves the required XP for leveling up based on the crafting line and user's mastery level.
 * 
 * This function calculates the required XP by:
 * - Using the base XP for the current level of the specified crafting line.
 * - Applying multipliers based on the user's current mastery level in all relevant crafting lines.
 * 
 * @param craftingLine - The target crafting line.
 * @param currentLevel - The current level of user's profession mastery.
 * @param craftingMastery - The current mastery of the user.
 */
export const GET_PROFESSION_REQUIRED_XP = (craftingLine: CraftingRecipeLine, currentLevel: number, craftingMastery: CraftingMastery) => {
    // get the XP multipliers for the given crafting line
    const multipliers = GET_PROFESSION_REQUIRED_XP_MULTIPLIER(craftingLine);
    let multiplier = 0;

    // loop through all crafting lines to calculate the combined multiplier
    for (const [key, value] of Object.entries(craftingMastery)) {
        const profession = key as CraftingRecipeLine;
        const stats = value as CraftingMasteryStats;

        // skip if the current crafting line is the same with targeted crafting line
        if (craftingLine === profession) continue;        

        // sum the XP multiplier by the relevant multipliers for each line
        multiplier += multipliers[profession][stats.level - 1]
    }

    // return the calculated required XP for leveling up
    return PROFESSION_BASE_REQUIRED_XP[craftingLine][currentLevel - 1] * multiplier;
}

/**
 * Retrieves the crafting success rate for each level in a given crafting profession
 * based on the asset's rarity. The returned array contains success rates for levels
 * starting from 1 up to 15, where each index corresponds to a specific level.
 *
 * - For example:
 *   - Index 0: Success rate for level 1
 *   - Index 1: Success rate for level 2
 *   - Index 2: Success rate for level 3, and so on.
 *
 * @param {CraftingRecipeLine} line - The crafting profession line (e.g., Craftsman).
 * @param {CraftedAssetRarity} rarity - The rarity of the crafted asset (e.g., Common, Rare).
 * @returns {number[]} An array of success rates for each crafting level (1 to 15).
 *
 * Notes:
 * - Success rates are represented as decimal values (e.g., 0.75 = 75% success rate).
 * - Rarity-specific rates apply to all professions except "Craftsman", which has unique rates.
 */
export const GET_CRAFTING_SUCCESS_RATE = (line: CraftingRecipeLine, rarity: CraftedAssetRarity) => {
    // return the fondation profession success rate if the profession is Craftsman
    if (line === CraftingRecipeLine.CRAFTSMAN) {
        switch (rarity) {
            case CraftedAssetRarity.COMMON:
            case CraftedAssetRarity.UNCOMMON:
                return [0.75, 0.80, 0.85, 0.90, 0.95, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00];
            case CraftedAssetRarity.RARE:
                return [0.20, 0.20, 0.20, 0.30, 0.40, 0.70, 0.85, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00];
            case CraftedAssetRarity.EPIC:
                return [0.10, 0.10, 0.10, 0.15, 0.20, 0.40, 0.50, 0.60, 0.70, 0.85, 1.00, 1.00, 1.00, 1.00, 1.00];
            case CraftedAssetRarity.LEGENDARY:
                return [0.05, 0.05, 0.05, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00];
            default:
                return Array(15).fill(0.00); // return 0% success for unknown rarity
        }
    }

    switch (rarity) {
        case CraftedAssetRarity.COMMON:
        case CraftedAssetRarity.UNCOMMON:
            return [0.75, 0.80, 0.85, 0.90, 0.95, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00];
        case CraftedAssetRarity.RARE:
            return [0.20, 0.20, 0.20, 0.30, 0.40, 0.70, 0.85, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00];
        case CraftedAssetRarity.EPIC:
            return [0.10, 0.10, 0.10, 0.15, 0.20, 0.40, 0.50, 0.60, 0.70, 0.85, 1.00, 1.00, 1.00, 1.00, 1.00];
        case CraftedAssetRarity.LEGENDARY:
            return [0.05, 0.05, 0.05, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00];
        default:
            return Array(15).fill(0.00); // return 0% success for unknown rarity
    }
}


/**
 * Get the crafting level for a specific crafting line for a user's crafting mastery based on their current XP for that line.
 */
export const GET_CRAFTING_LEVEL = (line: CraftingRecipeLine, currentXP: number): number => {
    // for now, all lines have the same levelling system. will be changed later.
    if (currentXP <= 4999) {
        return 1;
    } else if (currentXP <= 12499) {
        return 2;
    } else if (currentXP <= 22499) {
        return 3;
    } else if (currentXP <= 34999) {
        return 4;
    } else if (currentXP <= 49999) {
        return 5;
    } else if (currentXP <= 67499) {
        return 6;
    } else if (currentXP <= 87499) {
        return 7;
    } else if (currentXP <= 109999) {
        return 8;
    } else if (currentXP <= 134999) {
        return 9;
    } else {
        // cap level at 10 for now.
        return 10;
    }
}

/**
 * Populates the `CRAFTING_RECIPES` array with all the crafting recipes available from the database.
 * Then, populates all crafting asset enums in `models/item.ts` with the assets available from the database's crafting recipes.
 */
export const populateCraftingRecipesAndAssetEnums = async (): Promise<void> => {
    try {
        const recipes = await CraftingRecipeModel.find().lean();

        if (!recipes) {
            return;
        }

        CRAFTING_RECIPES = recipes;

        // populate enums
        recipes.forEach(recipe => {
            // check the recipe's craftedAssetData.asset. based on the name, populate the asset enums.
            // for example, if the asset contains `Transmutation`, populate the TransmutationItem enum.
            // if the asset contains `Augmentation`, populate the AugmentationItem enum an dso on.
            const asset = recipe.craftedAssetData.asset;

            // populate all keys in upper cases
            if (asset.includes('Potion')) {
                // Populate PotionEnum
                PotionEnum[asset.toUpperCase()] = asset;
            } else if (asset.includes('Totem of Energy')) {
                // Populate EnergyTotemEnum
                EnergyTotemEnum[asset.toUpperCase()] = asset;
            } else if (asset.includes('Transmutation')) {
                // Populate TransmutationEnum
                TransmutationEnum[asset.toUpperCase()] = asset;
            } else if (asset.includes('Augmentation')) {
                // Populate AugmentationEnum
                AugmentationEnum[asset.toUpperCase()] = asset;
            } else if (asset.includes('Relic')) {
                // Populate ContinuumRelicEnum
                ContinuumRelicEnum[asset.toUpperCase()] = asset;
            } else if (asset.includes('Ingot')) {
                // Populate IngotEnum
                IngotEnum[asset.toUpperCase()] = asset;
            }
        })

        console.log(`(populateCraftingRecipesAndAssetEnums) Successfully populated the crafting recipe and asset enums.`);
    } catch (err: any) {
        console.error(`(populateCraftingRecipesAndSynthesizingItems) ${err.message}`);
    }
}

/**
 * Contains all the crafting recipes available from the database. This will be empty by default.
 * 
 * On runtime, this will be populated when `populateCraftingRecipes` is called on the main function.
 */
export let CRAFTING_RECIPES: CraftingRecipe[];