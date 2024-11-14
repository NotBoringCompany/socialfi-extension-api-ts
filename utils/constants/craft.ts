import Bull from 'bull';
import { AssetType } from '../../models/asset';
import { CraftedAssetData, CraftedAssetRarity, CraftingQueueStatus, CraftingRecipe, CraftingRecipeLine } from "../../models/craft";
import { ContinuumRelicItem, EnergyTotemItem, IngotItem, Item, PotionItem, AugmentationItem, TransmutationItem, WonderArtefactItem, PotionEnum, EnergyTotemEnum, TransmutationEnum, AugmentationEnum, WonderArtefactEnum, ContinuumRelicEnum, IngotEnum } from '../../models/item';
import { BarrenResource, CombinedResources, ExtendedResource, FruitResource, LiquidResource, OreResource, ResourceRarity, ResourceType, SimplifiedResource } from "../../models/resource";
import { FoodType } from '../../models/food';
import { CraftingQueueModel, CraftingRecipeModel, UserModel } from './db';
import { resources } from './resource';
import { POIName } from '../../models/poi';
import { generateObjectId } from '../crypto';

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
        case CraftingRecipeLine.SYNTHESIZING:
            return POIName.HOME;
        case CraftingRecipeLine.SMELTING:
            return POIName.EVERGREEN_VILLAGE;
        // by default just throw an error
        default:
            throw new Error(`(REQUIRED_POI_FOR_CRAFTING_LINE) Crafting line ${craftingRecipeLine} not implemented yet or not found.`);
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

        // populate synthesizing item enums
        recipes.forEach(recipe => {
            // check the recipe's craftedAssetData.asset. based on the name, populate the synthesizing item enums.
            // for example, if the asset contains `Transmutation`, populate the TransmutationItem enum.
            // if the asset contains `Augmentation`, populate the AugmentationItem enum an dso on.
            const asset = recipe.craftedAssetData.asset;

            if (asset.includes('Potion')) {
                // Populate PotionEnum
                PotionEnum[asset] = asset;
            } else if (asset.includes('Totem of Energy')) {
                // Populate EnergyTotemEnum
                EnergyTotemEnum[asset] = asset;
            } else if (asset.includes('Transmutation')) {
                // Populate TransmutationEnum
                TransmutationEnum[asset] = asset;
            } else if (asset.includes('Augmentation')) {
                // Populate AugmentationEnum
                AugmentationEnum[asset] = asset;
            } else if (asset.includes('of Wonder')) {
                // Populate WonderArtefactEnum
                WonderArtefactEnum[asset] = asset;
            } else if (asset.includes('Relic')) {
                // Populate ContinuumRelicEnum
                ContinuumRelicEnum[asset] = asset;
            } else if (asset.includes('Ingot')) {
                // Populate IngotEnum
                IngotEnum[asset] = asset;
            }
        })

        console.log(`(populateCraftingRecipesAndAssetEnums) Successfully populated the CRAFTING_RECIPES array and all crafting asset enums.`);
    } catch (err: any) {
        console.error(`(populateCraftingRecipesAndSynthesizingItems) ${err.message}`);
    }
}

// /**
//  * Populates all synthesizing item enums in `models/item.ts` with the synthesizing items available from the database's crafting recipes.
//  */
// export const populateSynthesizingItems = async (): Promise<void> => {
//     try {
//         const recipes = await CraftingRecipeModel.find().lean();
//     } catch (err: any) {
//         console.error(`(populateSynthesizingItems) ${err.message}`);
//     }
// }

/**
 * Contains all the crafting recipes available from the database. This will be empty by default.
 * 
 * On runtime, this will be populated when `populateCraftingRecipes` is called on the main function.
 */
export let CRAFTING_RECIPES: CraftingRecipe[];