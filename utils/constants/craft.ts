import Bull from 'bull';
import { AssetType } from '../../models/asset';
import { CraftedAssetRarity, CraftingRecipe, CraftingRecipeLine } from "../../models/craft";
import { RestorationItem } from '../../models/item';
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
            craftingRecipeLine: CraftingRecipeLine.RESTORATION,
            craftingDuration: 60,
            baseEnergyRequired: 10,
            baseSuccessChance: 70,
            baseCritChance: 0,
            obtainedPoints: 10,
            requiredXCookies: 0.10,
            requiredLevel: 1,
            requiredCraftingLevel: 1,
            earnedEXP: 10,
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
        }
    ];