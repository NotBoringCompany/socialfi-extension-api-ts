import { AssetType } from './asset';
import { FoodType } from './food';
import { ContinuumRelicItem, EnergyTotemItem, PotionItem, RestorationItem, TransmutationItem } from './item';
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
    earnedXP: number;
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
    /** the asset type. used to make logic for granting the user the asset easier. */
    assetType: 'item' | 'food' | 'resource';
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
    /** related to consumables or any basic assets */
    SYNTHESIZING = 'Synthesizing',
    BLACKSMITHING = 'Blacksmithing',
    COOKING = 'Cooking',
    TAILORING = 'Tailoring'
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
     * the asset category of the required asset.
     */
    assetCategory: 'resource' | 'food' | 'item';
    /**
     * the specific asset required to craft the recipe.
     * 
     * having a specific `specificAsset` and having `specificAsset` as `any` is allowed.
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
 * Represents an asset that's being crafted from a recipe and is added to the crafting queue to be claimed after the duration ends.
 * 
 * Each time a player crafts something, a new CraftingQueue instance will be created (because of time-based crafting).
 * Simply incrementing the amount of an existing asset that's being crafted DOES NOT WORK!
 * 
 * NOTE: CraftingQueue instances that have the status `CLAIMABLE` means that the player can claim the asset.
 */
export interface CraftingQueue {
    /** the user's database ID */
    userId: string;
    /** the status of the ongoing craft */
    status: CraftingQueueStatus;
    // the crafting line of the recipe used to craft this asset
    craftingRecipeLine: CraftingRecipeLine;
    /** the data of the asset being crafted */
    craftedAssetData: CraftingQueueAssetData;
    /** the assets used to craft the recipe for this CraftingQueue instance */
    assetsUsed: CraftingQueueUsedAssetData;
    /** claiming data for this CraftingQueue instance */
    claimData: CraftingQueueClaimData;
    /** when the recipe was crafted */
    craftingStart: number;
    /** when the crafting will be completed; the user will receive the asset then */
    craftingEnd: number;
}

/**
 * Represents the claiming data for a CraftingQueue instance.
 * 
 * Used to show how many of the crafted asset the user can currently claim and how many has been claimed.
 */
export interface CraftingQueueClaimData {
    /** the amount of the crafted asset that the user can claim (now) */
    claimableAmount: number;
    /** the amount of the crafted asset that the user has claimed so far */
    claimedAmount: number;
}

/**
 * Modified version of `CraftedAssetData` for crafted assets used primarily for `CraftingQueue` instances.
 * 
 * This is used to only display required info.
 */
export interface CraftingQueueAssetData {
    /**
     * the resulting asset from crafting via this recipe.
     */
    asset: CraftableAsset;
    /** the number of `asset` being crafted in this instance. */
    amount: number;
    /**
     * the asset type. used to make logic for granting the user the asset easier.
     */
    assetType: 'item' | 'food' | 'resource';
    /** the total weight of the crafted asset(s). Calculated by the base weight of the asset * the `amount` */
    totalWeight: number;
}

/**
 * Represents the required assets used to craft a recipe to create an ongoing craft.
 */
export interface CraftingQueueUsedAssetData {
    /**
     * Required assets are assets that have an exact type specified on the recipe.
     * 
     * This means that the user must use that exact asset with that exact amount to fulfill that part of the recipe's requirements.
     */
    requiredAssets: CraftingRecipeRequiredAssetData[];
    /**
     * Flexible required assets are assets that have 'any' as the specific asset required, meaning that the player can input
     * any asset of that category (and rarity, if applicable) to fulfill that part of the recipe's requirements.
     * 
     * For example, if a recipe requires 15 of ANY common resources, the user can input 3 of common resource A, 4 of common resource B...
     * to make 15 in total. they can also just put 15 of a single common resource. This means that flexibility is prevalent here.
     */
    chosenFlexibleRequiredAssets: CraftingRecipeRequiredAssetData[];
}

/**
 * Represents the status of an ongoing craft.
 */
export enum CraftingQueueStatus {
    ONGOING = 'Ongoing',
    CLAIMABLE = 'Claimable',
    CLAIMED = 'Claimed',
    CANCELLED = 'Cancelled',
}

/**
 * Represents a craftable asset.
 */
export type CraftableAsset = RestorationItem | TransmutationItem | EnergyTotemItem | ContinuumRelicItem | PotionItem;