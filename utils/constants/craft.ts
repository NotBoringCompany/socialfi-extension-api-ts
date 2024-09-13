import Bull from 'bull';
import { AssetType } from '../../models/asset';
import { CraftedAssetRarity, CraftingRecipe, CraftingRecipeLine } from "../../models/craft";
import { RestorationItem, WonderArtefactItem } from '../../models/item';
import { BarrenResource, CombinedResources, ExtendedResource, FruitResource, LiquidResource, OreResource, ResourceRarity, ResourceType, SimplifiedResource } from "../../models/resource";

/**
 * Creates a new Bull instance for crafting assets to be queued.
 */
export const CRAFT_QUEUE = new Bull('craftQueue', {
    redis: process.env.REDIS_URL
});

export const CRAFTING_RECIPES: CraftingRecipe[] =
    [
        {
            craftedAssetData: {
                asset: RestorationItem.PARCHMENT_OF_RESTORATION,
                assetDescription: `Select an Isle (Exotic rarity or below) and instantly restore 1% of total resources.`,
                assetRarity: CraftedAssetRarity.COMMON,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            craftingDuration: 60,
            baseEnergyRequired: 50,
            baseSuccessChance: 70,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 1,
            earnedEXP: 50,
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
                asset: RestorationItem.SCROLL_OF_RESTORATION,
                assetDescription: `Select an Isle (Exotic rarity or below) and instantly restore 3% of total resources.`,
                assetRarity: CraftedAssetRarity.UNCOMMON,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            craftingDuration: 600,
            baseEnergyRequired: 50,
            baseSuccessChance: 70,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 1,
            earnedEXP: 100,
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
                asset: RestorationItem.TOME_OF_RESTORATION,
                assetDescription: `Select an Isle (Exotic rarity or below) and instantly restore 7% of total resources.`,
                assetRarity: CraftedAssetRarity.RARE,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 4 hours
            craftingDuration: 14400,
            baseEnergyRequired: 100,
            baseSuccessChance: 70,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 3,
            earnedEXP: 250,
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
                asset: RestorationItem.ANCIENT_SCROLL_OF_RESTORATION,
                assetDescription: `Select an Isle (any rarity) and instantly restore 10% of total resources.`,
                assetRarity: CraftedAssetRarity.EPIC,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 12 hours
            craftingDuration: 43200,
            baseEnergyRequired: 100,
            baseSuccessChance: 70,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 4,
            earnedEXP: 500,
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
                asset: RestorationItem.ANCIENT_TOME_OF_RESTORATION,
                assetDescription: `Select an Isle (any rarity) and instantly restore 20% of total resources.`,
                assetRarity: CraftedAssetRarity.LEGENDARY,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 24 hours
            craftingDuration: 86400,
            baseEnergyRequired: 200,
            baseSuccessChance: 70,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 5,
            earnedEXP: 1000,
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
    ];