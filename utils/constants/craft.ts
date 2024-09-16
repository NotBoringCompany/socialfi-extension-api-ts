import Bull from 'bull';
import { AssetType } from '../../models/asset';
import { CraftedAssetRarity, CraftingRecipe, CraftingRecipeLine } from "../../models/craft";
import { ContinuumRelicItem, EnergyTotemItem, IngotItem, PotionItem, RestorationItem, TransmutationItem, WonderArtefactItem } from '../../models/item';
import { BarrenResource, CombinedResources, ExtendedResource, FruitResource, LiquidResource, OreResource, ResourceRarity, ResourceType, SimplifiedResource } from "../../models/resource";
import { FoodType } from '../../models/food';
import e from 'express';

/**
 * Creates a new Bull instance for crafting assets to be queued.
 */
export const CRAFT_QUEUE = new Bull('craftQueue', {
    redis: process.env.REDIS_URL
});

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
                asset: RestorationItem.PARCHMENT_OF_RESTORATION,
                assetType: 'item',
                assetDescription: `Select an Isle (Exotic rarity or below) and instantly restore 1% of total resources.`,
                assetRarity: CraftedAssetRarity.COMMON,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            craftingDuration: 60,
            baseEnergyRequired: 50,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 1,
            earnedXP: 50,
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
                assetType: 'item',
                assetDescription: `Select an Isle (Exotic rarity or below) and instantly restore 3% of total resources.`,
                assetRarity: CraftedAssetRarity.UNCOMMON,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            craftingDuration: 600,
            baseEnergyRequired: 50,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 1,
            earnedXP: 100,
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
                assetType: 'item',
                assetDescription: `Select an Isle (Exotic rarity or below) and instantly restore 7% of total resources.`,
                assetRarity: CraftedAssetRarity.RARE,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 4 hours
            craftingDuration: 14400,
            baseEnergyRequired: 100,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 3,
            earnedXP: 250,
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
                assetType: 'item',
                assetDescription: `Select an Isle (any rarity) and instantly restore 10% of total resources.`,
                assetRarity: CraftedAssetRarity.EPIC,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 12 hours
            craftingDuration: 43200,
            baseEnergyRequired: 100,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 4,
            earnedXP: 500,
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
                assetType: 'item',
                assetDescription: `Select an Isle (any rarity) and instantly restore 20% of total resources.`,
                assetRarity: CraftedAssetRarity.LEGENDARY,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            // 24 hours
            craftingDuration: 86400,
            baseEnergyRequired: 200,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 5,
            earnedXP: 1000,
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
                assetRarity: CraftedAssetRarity.COMMON,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            craftingDuration: 60,
            baseEnergyRequired: 50,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 1,
            earnedXP: 50,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        // to be added
                    ]
                }
            ]
        },
        {
            craftedAssetData: {
                asset: TransmutationItem.STAFF_OF_TRANSMUTATION,
                assetType: 'item',
                assetDescription: `Select an Isle (Exotic rarity or below) and transmute the Isle's current resource line into another line.`,
                assetRarity: CraftedAssetRarity.UNCOMMON,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            craftingDuration: 600,
            baseEnergyRequired: 50,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 1,
            earnedXP: 100,
            weight: 0,
            requiredAssetGroups: [
                {
                    requiredAssets: [
                        // to be added
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
            craftingDuration: 43200,
            baseEnergyRequired: 100,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 4,
            earnedXP: 500,
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
                asset: EnergyTotemItem.SMALL_TOTEM_OF_ENERGY,
                assetType: 'item',
                assetDescription: `Select an Isle and receive +2.5% Isle farming rate & -12.5% energy consumption for all bits there.`,
                assetRarity: CraftedAssetRarity.COMMON,
                assetEffectDuration: 'none'
            },
            craftingRecipeLine: CraftingRecipeLine.SYNTHESIZING,
            craftingDuration: 60,
            baseEnergyRequired: 50,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 1,
            earnedXP: 50,
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
            craftingDuration: 600,
            baseEnergyRequired: 50,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 1,
            earnedXP: 100,
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
            craftingDuration: 14400,
            baseEnergyRequired: 100,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 3,
            earnedXP: 250,
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
            craftingDuration: 14400,
            baseEnergyRequired: 100,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 3,
            earnedXP: 250,
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
            craftingDuration: 43200,
            baseEnergyRequired: 100,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 4,
            earnedXP: 500,
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
            craftingDuration: 86400,
            baseEnergyRequired: 200,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 5,
            earnedXP: 1000,
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
            craftingDuration: 14400,
            baseEnergyRequired: 100,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 3,
            earnedXP: 250,
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
            craftingDuration: 43200,
            baseEnergyRequired: 100,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 4,
            earnedXP: 500,
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
            craftingDuration: 86400,
            baseEnergyRequired: 200,
            baseSuccessChance: 100,
            baseCritChance: 0,
            obtainedPoints: 0,
            requiredXCookies: 0,
            requiredLevel: 1,
            requiredCraftingLevel: 5,
            earnedXP: 1000,
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
    ];