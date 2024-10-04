import Bull from 'bull';
import { AssetType } from '../../models/asset';
import { CraftedAssetData, CraftedAssetRarity, CraftingQueueStatus, CraftingRecipe, CraftingRecipeLine } from "../../models/craft";
import { ContinuumRelicItem, EnergyTotemItem, IngotItem, Item, PotionItem, AugmentationItem, TransmutationItem, WonderArtefactItem } from '../../models/item';
import { BarrenResource, CombinedResources, ExtendedResource, FruitResource, LiquidResource, OreResource, ResourceRarity, ResourceType, SimplifiedResource } from "../../models/resource";
import { FoodType } from '../../models/food';
import { CraftingQueueModel, UserModel } from './db';
import { resources } from './resource';
import { POIName } from '../../models/poi';

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
export const BASE_CRAFTING_DURATION_COMMON_INGOT = 1;
export const BASE_CRAFTING_DURATION_UNCOMMON_INGOT = 5;
export const BASE_CRAFTING_DURATION_RARE_INGOT = 10;
export const BASE_CRAFTING_DURATION_EPIC_INGOT = 15;

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

export const CRAFTING_RECIPES: CraftingRecipe[] =
    [
        {
            craftedAssetData: {
                asset: AugmentationItem.PARCHMENT_OF_AUGMENTATION,
                assetType: 'item',
                assetDescription: `Select an Isle (Exotic rarity or below) and instantly restore 1% of total resources.`,
                assetRarity: CraftedAssetRarity.COMMON,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            craftingDuration: BASE_CRAFTING_DURATION_COMMON,
            baseEnergyRequired: BASE_ENERGY_COST_COMMON,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_COMMON,
            earnedXP: EARNED_XP_COMMON,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            // 15 of any common resource
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.COMMON,
                            amount: 15
                        },
                        {
                            // 5 of any uncommon resource
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.UNCOMMON,
                            amount: 5
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: AugmentationItem.SCROLL_OF_AUGMENTATION,
                assetType: 'item',
                assetDescription: `Select an Isle (Exotic rarity or below) and instantly restore 3% of total resources.`,
                assetRarity: CraftedAssetRarity.UNCOMMON,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            craftingDuration: BASE_CRAFTING_DURATION_UNCOMMON,
            baseEnergyRequired: BASE_ENERGY_COST_UNCOMMON,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_UNCOMMON,
            earnedXP: EARNED_XP_UNCOMMON,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.COMMON,
                            amount: 20
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.UNCOMMON,
                            amount: 10
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: AugmentationItem.TOME_OF_AUGMENTATION,
                assetType: 'item',
                assetDescription: `Select an Isle (Exotic rarity or below) and instantly restore 7% of total resources.`,
                assetRarity: CraftedAssetRarity.RARE,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 4 hours
            craftingDuration: BASE_CRAFTING_DURATION_RARE,
            baseEnergyRequired: BASE_ENERGY_COST_RARE,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_RARE,
            earnedXP: EARNED_XP_RARE,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.COMMON,
                            amount: 30
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.UNCOMMON,
                            amount: 15
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.RARE,
                            amount: 5
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: AugmentationItem.ANCIENT_SCROLL_OF_AUGMENTATION,
                assetType: 'item',
                assetDescription: `Select an Isle (any rarity) and instantly restore 10% of total resources.`,
                assetRarity: CraftedAssetRarity.EPIC,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 12 hours
            craftingDuration: BASE_CRAFTING_DURATION_EPIC,
            baseEnergyRequired: BASE_ENERGY_COST_EPIC,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_EPIC,
            earnedXP: EARNED_XP_EPIC,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.RARE,
                            amount: 30
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.EPIC,
                            amount: 15
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: AugmentationItem.ANCIENT_TOME_OF_AUGMENTATION,
                assetType: 'item',
                assetDescription: `Select an Isle (any rarity) and instantly restore 20% of total resources.`,
                assetRarity: CraftedAssetRarity.LEGENDARY,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 24 hours
            craftingDuration: BASE_CRAFTING_DURATION_LEGENDARY,
            baseEnergyRequired: BASE_ENERGY_COST_LEGENDARY,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_LEGENDARY,
            earnedXP: EARNED_XP_LEGENDARY,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.RARE,
                            amount: 30
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.EPIC,
                            amount: 15
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.LEGENDARY,
                            amount: 5
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: WonderArtefactItem.ESSENCE_OF_WONDER,
                            requiredRarity: 'none',
                            amount: 3
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: TransmutationItem.WAND_OF_TRANSMUTATION,
                assetType: 'item',
                assetDescription: `Select an Isle (Verdant rarity or below) and transmute the Isle's current resource line into another line.`,
                assetRarity: CraftedAssetRarity.UNCOMMON,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            craftingDuration: BASE_CRAFTING_DURATION_UNCOMMON,
            baseEnergyRequired: BASE_ENERGY_COST_UNCOMMON,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_UNCOMMON,
            earnedXP: EARNED_XP_UNCOMMON,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'item',
                            specificAsset: AugmentationItem.SCROLL_OF_AUGMENTATION,
                            requiredRarity: 'none',
                            amount: 3,
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: IngotItem.IRON_INGOT,
                            requiredRarity: 'none',
                            amount: 5
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: TransmutationItem.STAFF_OF_TRANSMUTATION,
                assetType: 'item',
                assetDescription: `Select an Isle (Exotic rarity or below) and transmute the Isle's current resource line into another line.`,
                assetRarity: CraftedAssetRarity.RARE,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            craftingDuration: BASE_CRAFTING_DURATION_RARE,
            baseEnergyRequired: BASE_ENERGY_COST_RARE,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_RARE,
            earnedXP: EARNED_XP_RARE,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'item',
                            specificAsset: AugmentationItem.TOME_OF_AUGMENTATION,
                            requiredRarity: 'none',
                            amount: 3,
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: IngotItem.SILVER_INGOT,
                            requiredRarity: 'none',
                            amount: 5
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: TransmutationItem.ROYAL_SCEPTER_OF_TRANSMUTATION,
                assetType: 'item',
                assetDescription: `Select an Isle (any rarity) and transmute the Isle's current resource line into another line.`,
                assetRarity: CraftedAssetRarity.EPIC,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 12 hours
            craftingDuration: BASE_CRAFTING_DURATION_EPIC,
            baseEnergyRequired: BASE_ENERGY_COST_EPIC,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_EPIC,
            earnedXP: EARNED_XP_EPIC,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'item',
                            specificAsset: AugmentationItem.ANCIENT_SCROLL_OF_AUGMENTATION,
                            requiredRarity: 'none',
                            amount: 3,
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: IngotItem.GOLD_INGOT,
                            requiredRarity: 'none',
                            amount: 5
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: EnergyTotemItem.SMALL_TOTEM_OF_ENERGY,
                assetType: 'item',
                assetDescription: `Select an Isle and receive +2.5% Isle farming rate & -12.5% energy consumption for all bits there.`,
                assetRarity: CraftedAssetRarity.COMMON,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            craftingDuration: BASE_CRAFTING_DURATION_COMMON,
            baseEnergyRequired: BASE_ENERGY_COST_COMMON,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_COMMON,
            earnedXP: EARNED_XP_COMMON,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'resource',
                            specificAsset: FruitResource.TOMATO,
                            requiredRarity: 'none',
                            amount: 20
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: IngotItem.COPPER_INGOT,
                            requiredRarity: 'none',
                            amount: 5
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: EnergyTotemItem.BIG_TOTEM_OF_ENERGY,
                assetType: 'item',
                assetDescription: `Select an Isle and receive +5% Isle farming rate & -25% energy consumption for all bits there.`,
                assetRarity: CraftedAssetRarity.UNCOMMON,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            craftingDuration: BASE_CRAFTING_DURATION_UNCOMMON,
            baseEnergyRequired: BASE_ENERGY_COST_UNCOMMON,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_UNCOMMON,
            earnedXP: EARNED_XP_UNCOMMON,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'resource',
                            specificAsset: FruitResource.APPLE,
                            requiredRarity: 'none',
                            amount: 10
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: IngotItem.COPPER_INGOT,
                            requiredRarity: 'none',
                            amount: 10
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: FruitResource.MELON,
                            requiredRarity: 'none',
                            amount: 1
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: EnergyTotemItem.GRAND_TOTEM_OF_ENERGY,
                assetType: 'item',
                assetDescription: `Select an Isle and receive +5% Isle farming rate & -50% energy consumption for all bits there.`,
                assetRarity: CraftedAssetRarity.RARE,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 4 hours
            craftingDuration: BASE_CRAFTING_DURATION_RARE,
            baseEnergyRequired: BASE_ENERGY_COST_RARE,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_RARE,
            earnedXP: EARNED_XP_RARE,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'resource',
                            specificAsset: FruitResource.STAR_FRUIT,
                            requiredRarity: 'none',
                            amount: 10
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: IngotItem.IRON_INGOT,
                            requiredRarity: 'none',
                            amount: 10
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: FruitResource.MELON,
                            requiredRarity: 'none',
                            amount: 5
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: WonderArtefactItem.ESSENCE_OF_WONDER,
                            requiredRarity: 'none',
                            amount: 3
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: ContinuumRelicItem.FADED_CONTINUUM_RELIC,
                assetType: 'item',
                assetDescription: `Select a Bit (rare rarity or below) and allow transfer to Season 1.`,
                assetRarity: CraftedAssetRarity.RARE,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 4 hours
            craftingDuration: BASE_CRAFTING_DURATION_RARE,
            baseEnergyRequired: BASE_ENERGY_COST_RARE,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_RARE,
            earnedXP: EARNED_XP_RARE,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'item',
                            specificAsset: IngotItem.IRON_INGOT,
                            requiredRarity: 'none',
                            amount: 25
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.EPIC,
                            amount: 15
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: WonderArtefactItem.ESSENCE_OF_WONDER,
                            requiredRarity: 'none',
                            amount: 5
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: ContinuumRelicItem.GLEAMING_CONTINUUM_RELIC,
                assetType: 'item',
                assetDescription: `Select a Bit (epic rarity or below) and allow transfer to Season 1.`,
                assetRarity: CraftedAssetRarity.EPIC,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 12 hours
            craftingDuration: BASE_CRAFTING_DURATION_EPIC,
            baseEnergyRequired: BASE_ENERGY_COST_EPIC,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_EPIC,
            earnedXP: EARNED_XP_EPIC,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'item',
                            specificAsset: IngotItem.IRON_INGOT,
                            requiredRarity: 'none',
                            amount: 25
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.EPIC,
                            amount: 15
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: IngotItem.GOLD_INGOT,
                            requiredRarity: 'none',
                            amount: 5
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: WonderArtefactItem.LIGHT_OF_WONDER,
                            requiredRarity: 'none',
                            amount: 5
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: ContinuumRelicItem.MYTHIC_CONTINUUM_RELIC,
                assetType: 'item',
                assetDescription: `Select a Bit (any rarity) and allow transfer to Season 1.`,
                assetRarity: CraftedAssetRarity.LEGENDARY,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 24 hours
            craftingDuration: BASE_CRAFTING_DURATION_LEGENDARY,
            baseEnergyRequired: BASE_ENERGY_COST_LEGENDARY,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_LEGENDARY,
            earnedXP: EARNED_XP_LEGENDARY,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'item',
                            specificAsset: IngotItem.IRON_INGOT,
                            requiredRarity: 'none',
                            amount: 25
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: 'any',
                            requiredRarity: ResourceRarity.EPIC,
                            amount: 20
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: IngotItem.GOLD_INGOT,
                            requiredRarity: 'none',
                            amount: 10
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: WonderArtefactItem.LIGHT_OF_WONDER,
                            requiredRarity: 'none',
                            amount: 15
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: PotionItem.POTION_OF_LUCK,
                assetType: 'item',
                assetDescription: `Select a Bit and reroll one trait randomly.`,
                assetRarity: CraftedAssetRarity.RARE,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 4 hours
            craftingDuration: BASE_CRAFTING_DURATION_RARE,
            baseEnergyRequired: BASE_ENERGY_COST_RARE,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_RARE,
            earnedXP: EARNED_XP_RARE,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'resource',
                            specificAsset: LiquidResource.WATER,
                            requiredRarity: 'none',
                            amount: 50
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: LiquidResource.MAPLE_SYRUP,
                            requiredRarity: 'none',
                            amount: 15
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: LiquidResource.HONEY,
                            requiredRarity: 'none',
                            amount: 5
                        },
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: PotionItem.POTION_OF_ENLIGHTENMENT,
                assetType: 'item',
                assetDescription: `Select a Bit and reroll all traits randomly.`,
                assetRarity: CraftedAssetRarity.EPIC,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 12 hours
            craftingDuration: BASE_CRAFTING_DURATION_EPIC,
            baseEnergyRequired: BASE_ENERGY_COST_EPIC,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_EPIC,
            earnedXP: EARNED_XP_EPIC,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'resource',
                            specificAsset: LiquidResource.WATER,
                            requiredRarity: 'none',
                            amount: 50
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: LiquidResource.HONEY,
                            requiredRarity: 'none',
                            amount: 15
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: LiquidResource.MOONLIGHT_DEW,
                            requiredRarity: 'none',
                            amount: 5
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: WonderArtefactItem.ESSENCE_OF_WONDER,
                            requiredRarity: 'none',
                            amount: 10
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: PotionItem.POTION_OF_DIVINE_ENLIGHTENMENT,
                assetType: 'item',
                assetDescription: `Select a Bit and reroll all traits randomly. Positive traits are guaranteed.`,
                assetRarity: CraftedAssetRarity.LEGENDARY,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 24 hours
            craftingDuration: BASE_CRAFTING_DURATION_LEGENDARY,
            baseEnergyRequired: BASE_ENERGY_COST_LEGENDARY,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_LEGENDARY,
            earnedXP: EARNED_XP_LEGENDARY,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'resource',
                            specificAsset: LiquidResource.WATER,
                            requiredRarity: 'none',
                            amount: 50
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: FruitResource.DRAGON_FRUIT,
                            requiredRarity: 'none',
                            amount: 5
                        },
                        {
                            assetCategory: 'resource',
                            specificAsset: LiquidResource.PHOENIX_TEAR,
                            requiredRarity: 'none',
                            amount: 5
                        },
                        {
                            assetCategory: 'item',
                            specificAsset: WonderArtefactItem.LIGHT_OF_WONDER,
                            requiredRarity: 'none',
                            amount: 10
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: IngotItem.COPPER_INGOT,
                assetType: 'item',
                assetDescription: `A refined slab of copper.`,
                assetRarity: CraftedAssetRarity.COMMON,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SMELTING,
            craftingDuration: BASE_CRAFTING_DURATION_COMMON_INGOT,
            baseEnergyRequired: BASE_ENERGY_COST_COMMON_INGOT,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_COMMON,
            earnedXP: EARNED_XP_COMMON_INGOT,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'resource',
                            specificAsset: OreResource.COPPER,
                            requiredRarity: 'none',
                            amount: 2
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: IngotItem.IRON_INGOT,
                assetType: 'item',
                assetDescription: `A refined slab of iron.`,
                assetRarity: CraftedAssetRarity.UNCOMMON,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SMELTING,
            craftingDuration: BASE_CRAFTING_DURATION_UNCOMMON_INGOT,
            baseEnergyRequired: BASE_ENERGY_COST_UNCOMMON_INGOT,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_UNCOMMON,
            earnedXP: EARNED_XP_UNCOMMON_INGOT,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'resource',
                            specificAsset: OreResource.IRON,
                            requiredRarity: 'none',
                            amount: 2
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: IngotItem.SILVER_INGOT,
                assetType: 'item',
                assetDescription: `A refined slab of silver.`,
                assetRarity: CraftedAssetRarity.RARE,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SMELTING,
            craftingDuration: BASE_CRAFTING_DURATION_RARE_INGOT,
            baseEnergyRequired: BASE_ENERGY_COST_RARE_INGOT,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_RARE,
            earnedXP: EARNED_XP_RARE_INGOT,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'resource',
                            specificAsset: OreResource.SILVER,
                            requiredRarity: 'none',
                            amount: 2
                        }
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: IngotItem.GOLD_INGOT,
                assetType: 'item',
                assetDescription: `A refined slab of gold.`,
                assetRarity: CraftedAssetRarity.EPIC,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SMELTING,
            craftingDuration: BASE_CRAFTING_DURATION_EPIC_INGOT,
            baseEnergyRequired: BASE_ENERGY_COST_EPIC_INGOT,
            baseSuccessChance: 10000,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: REQUIRED_CRAFTING_LEVEL_EPIC,
            earnedXP: EARNED_XP_EPIC_INGOT,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        {
                            assetCategory: 'resource',
                            specificAsset: OreResource.GOLD,
                            requiredRarity: 'none',
                            amount: 2
                        }
                    ]
                }
            ]
        }
    ];