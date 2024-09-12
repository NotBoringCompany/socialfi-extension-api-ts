import { AssetType } from './asset';
import { FoodType } from './food';
import { EnergyTotemItem, PotionItem, RestorationItem, TeleporterItem, TransmutationItem } from './item';
import { BarrenResource, ExtendedResource, FruitResource, LiquidResource, OreResource, Resource, ResourceRarity, ResourceType, SimplifiedResource } from "./resource";

/**
 * Represents a crafting recipe with the required assets to craft the recipe.
 */
export interface CraftingRecipe {
    /** the data/stats of the asset that's crafted from this recipe */
    craftedAssetData: CraftedAssetData;
    /** the `line`, `category` or type of crafting recipe */
    craftingRecipeLine: CraftingRecipeLine;
    /** the amount of time taken to craft this recipe (in seconds) */
    craftingDuration: number;
    /** the base energy required to craft 1 of the `craftedAssetType` */
    baseEnergyRequired: number;
    /** 
     * base success chance of obtaining at LEAST 1 of this asset upon crafting. 
     * 
     * number is in basis points (i.e. 0-9999), so each 100 is 1%.
     * 
     * if, for example, `baseSuccessChance` is not reached upon a dice roll, the player will not obtain the crafted asset at all, 
     * and they will lose the assets used to craft the asset.
     */
    baseSuccessChance: number;
    /**
     * the base chance that an extra asset of the same type will be obtained upon crafting, such that the user obtains 2 of the asset.
     * 
     * number is in basis points (i.e. 0-9999), so each 100 is 1%.
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
    /** 
     * the assets required to craft the recipe, grouped. 
     * 
     * this will facilitate the possibility of optional asset conditions. for example, to craft Item A,
     * a player requires, say, 1. 5 of resource A and 10 of resource B OR 2. 4 of resource C.
     * 
     * 5 of resource A and 10 of resource B (1) will be grouped into Group 1 (i.e. `requiredAssetGroups[0]`)
     * and 4 of resource C (2) will be grouped into Group 2 (i.e. `requiredAssetGroups[1]`)
     * 
     * if there is only 1 group, then the user must fulfill all the conditions in that group to craft the recipe.
     */
    requiredAssetGroups: CraftingRecipeRequiredAssetGroup[];
}

/**
 * Represents the data of the crafted asset.
 */
export interface CraftedAssetData {
    /** the resulting asset from crafting via this recipe */
    asset: CraftableAsset;
    /** the description of the crafted asset */
    assetDescription: string;
    /** the rarity of the crafted asset */
    assetRarity: CraftedAssetRarity;
    /**
     * some assets have an effect on the game mechanic, such as increasing the stats of an island, reducing energy depletion of bits, etc.
     * 
     * in this case, `assetEffectDuration` will be the duration of the effect.
     * 
     * if `none`, then the asset has no external effect with duration.
     */
    assetEffectDuration: number | 'none';
}

/**
 * The different types of crafting recipe lines.
 */
export enum CraftingRecipeLine {
    RESTORATION = 'Restoration',
    TRANSMUTATION = 'Transmutation',
    ENERGY_TOTEM = 'Energy Totem',
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

/** Numeric representation of `CraftedAssetRarity` */
export const CraftedAssetRarityNumeric: { [key in CraftedAssetRarity]: number } = {
    [CraftedAssetRarity.COMMON]: 0,
    [CraftedAssetRarity.UNCOMMON]: 1,
    [CraftedAssetRarity.RARE]: 2,
    [CraftedAssetRarity.EPIC]: 3,
    [CraftedAssetRarity.LEGENDARY]: 4,
}

/**
 * Represents a group of required assets for a crafting recipe.
 */
export interface CraftingRecipeRequiredAssetGroup {
    // the required assets for this group.
    requiredAssets: CraftingRecipeRequiredAssetData[];
}

/**
 * Represents the required asset data for a specific required asset group of a crafting recipe.
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
 * Represents an asset that's being crafted from a recipe and is still pending for the crafting process to be completed.
 * 
 * Each time a user crafts something, a new OngoingCraft instance will be created (because of time-based crafting).
 * Simply incrementing the amount of an existing asset that's being crafted DOES NOT WORK!
 */
export interface OngoingCraft {
    /** the user's database ID */
    userId: string;
    /** the asset that's being crafted in this process */
    craftedAsset: CraftableAsset;
    /** the amount of this asset */
    amount: number;
    /** when the recipe was crafted */
    craftingStart: number;
    /** when the crafting will be completed; the user will receive the asset then */
    craftingEnd: number;
}

/**
 * Represents a craftable asset.
 */
export type CraftableAsset = RestorationItem | TransmutationItem | EnergyTotemItem | TeleporterItem | PotionItem;