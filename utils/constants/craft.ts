import { AssetType } from '../../models/asset';
import { CraftedAssetRarity, CraftingRecipe, CraftingRecipeLine } from "../../models/craft";
import { RestorationItem } from '../../models/item';
import { BarrenResource, CombinedResources, ExtendedResource, FruitResource, LiquidResource, OreResource, ResourceRarity, ResourceType, SimplifiedResource } from "../../models/resource";

export const CRAFTING_RECIPES: CraftingRecipe[] =
    [
        {
            craftedAsset: RestorationItem.PARCHMENT_OF_RESTORATION,
            craftedAssetDescription: 'Select an Isle (Exotic rarity or below) and instantly restore 1% of total resources.',
            craftedAssetRarity: CraftedAssetRarity.COMMON,
            craftingRecipeLine: CraftingRecipeLine.RESTORATION,
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