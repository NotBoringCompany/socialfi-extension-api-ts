import { AssetType } from './asset';
import { FoodType } from './food';
import { EnergyItem, PotionItem, RestorationItem, TeleporterItem, TransmutationItem } from './item';
import { BarrenResource, ExtendedResource, FruitResource, LiquidResource, OreResource, Resource, ResourceRarity, ResourceType, SimplifiedResource } from "./resource";

/**
 * Represents a crafting recipe with the required assets to craft the recipe.
 */
export interface CraftingRecipe {
    /** the resulting asset from crafting via this recipe */
    craftedAsset: CraftableAsset;
    /** the description of the crafted asset */
    craftedAssetDescription: string;
    /** the rarity of the crafted asset */
    craftedAssetRarity: CraftedAssetRarity;
    /** the `line`, `category` or type of crafting recipe */
    craftingRecipeLine: CraftingRecipeLine;
    /** the base energy required to craft 1 of the `craftedAssetType` */
    baseEnergyRequired: number;
    /** 
     * base success chance of obtaining at LEAST 1 of this asset upon crafting. 
     * 
     * if, for example, `baseSuccessChance` is not reached upon a dice roll, the player will not obtain the crafted asset at all, 
     * and they will lose the assets used to craft the asset.
     */
    baseSuccessChance: number;
    /**
     * the base chance that an extra asset of the same type will be obtained upon crafting, such that the user obtains 2 of the asset.
     * 
     * exact implementation is TBD.
     */
    baseCritChance: number;
    /**
     * the points the user will obtain upon crafting, whether successful or not.
     */
    obtainedPoints: number;
    /**
     * the amount of `xCookies` required to craft the recipe.
     */
    requiredXCookies: number;
    /**
     * the required in-game level of the player to craft the recipe.
     * 
     * if `none`, then the player can craft the recipe at any level.
     */
    requiredLevel: number | 'none';
    /**
     * the required crafting level of the player to craft the recipe.
     * 
     * if `none`, then the player can craft the recipe at any crafting level.
     */
    requiredCraftingLevel: number | 'none';
    /**
     * the earned experience the player will obtain upon crafting the recipe.
     * 
     * Added to the user's craftingEXP.
     */
    earnedEXP: number;
    /**
     * the weight of 1 of the crafted asset.
     */
    weight: number;
    /** the required assets to craft the recipe */
    requiredAssets: CraftingRecipeRequiredAssetData[];
}

/**
 * The different types of crafting recipe lines.
 */
export enum CraftingRecipeLine {
    RESTORATION = 'Restoration',
    TRANSMUTATION = 'Transmutation',
    ENERGY = 'Energy',
    TELEPORTER = 'Teleporter',
    POTION = 'Potion'
}

/**
 * Represents the resulting asset that was crafted from a recipe.
 */
export type CraftedAssetType = AssetType;

/** 
 * Represents the crafted asset's rarity 
 */
export enum CraftedAssetRarity {
    COMMON = 'Common',
    UNCOMMON = 'Uncommon',
    RARE = 'Rare',
    EPIC = 'Epic',
    LEGENDARY = 'Legendary',
}

/** Numeric representation of `ResourceRarity` */
export const CraftedAssetRarityNumeric: { [key in ResourceRarity]: number } = {
    [CraftedAssetRarity.COMMON]: 0,
    [CraftedAssetRarity.UNCOMMON]: 1,
    [CraftedAssetRarity.RARE]: 2,
    [CraftedAssetRarity.EPIC]: 3,
    [CraftedAssetRarity.LEGENDARY]: 4,
}

/**
 * Represents the required asset data for a crafting recipe.
 */
export interface CraftingRecipeRequiredAssetData {
    /** 
     * the asset category.
     * 
     * if any, the user can use any asset (unless bound by other restrictions like minimum rarity for resources) to craft the asset.
     */
    assetCategory: 'resource' | 'food' | 'item' | 'any';
    /**
     * the specific asset required to craft the recipe.
     * 
     * if `assetCategory` is `any`, `specificAsset` SHOULD also be `any`.
     * however, having a specific `specificAsset` and having `specificAsset` as `any` is allowed.
     * 
     * for example, if `assetCategory` is `resource` and `specificAsset` is `any` and `requiredRarity` is `ResourceRarity.COMMON`,
     * the user can use any common resource to craft the recipe.
     */
    specificAsset: AssetType | 'any';
    /**
     * The minimum rarity of the asset required.
     * 
     * Some assets have no rarity, so the value can be 'none'.
     */
    requiredRarity: CraftedAssetRarity | ResourceRarity | 'none';
    /**
     * The amount of the asset required.
     */
    amount: number;
}

/**
 * Represents a craftable asset.
 */
export type CraftableAsset = RestorationItem | TransmutationItem | EnergyItem | TeleporterItem | PotionItem;