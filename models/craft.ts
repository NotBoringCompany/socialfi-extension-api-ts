import { AssetType } from './asset';
import { BitRarity } from './bit';
import { FoodType } from './food';
import { IslandType } from './island';
import { ContinuumRelicItem, EnergyTotemItem, IngotItem, PotionItem, AugmentationItem, TransmutationItem } from './item';
import { BarrenResource, ExtendedResource, FruitResource, LiquidResource, OreResource, Resource, ResourceRarity, ResourceType, SimplifiedResource } from "./resource";

/**
 * Represents a crafting recipe with the required assets to craft the recipe.
 */
export interface CraftingRecipe {
    /** the database ID of the crafting recipe */
    _id: string;
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
     * this will facilitate the possibility of optional asset conditions. for example, to craft asset A,
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
    asset: CraftableAsset | string;
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
    /**
     * extended data that shows the asset's limitations, effect values and so on (if applicable, such as for synthesizing items because they are consumable).
     */
    assetExtendedData: CraftedAssetExtendedData;
}

/**
 * Represents the extended data of the crafted asset.
 */
export interface CraftedAssetExtendedData {
    /**
     * if the asset to be used has a minimum rarity requirement for the island or bit it is used on.
     */
    minimumRarity: IslandType | BitRarity | null;
    /**
     * if the asset to be used has a maximum rarity requirement for the island or bit it is used on.
     */
    maximumRarity: IslandType | BitRarity | null;
    /**
     * the asset's limitations (e.g. the max limit of this asset usable on an island, etc.)
     */
    limitations: CraftedAssetLimitations;
    /** 
     * the effect values.
     */
    effectValues: CraftedAssetEffectValues;
}

/**
 * Represents the limitations of a crafted asset.
 */
export interface CraftedAssetLimitations {
    /**
     * if this asset can be applied on an empty island.
     * 
     * only applicable for assets that have effects on islands (otherwise it SHOULD be set to true anyway).
     */
    applicableOnEmptyIsland: boolean;
    /**
     * how many of THIS asset can be used in a single island CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this asset on the same island at the same time.
     * 
     * ONLY USABLE FOR assetS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    singleIslandConcurrentUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of ANY asset within this asset's category/type can be used in a single island CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 assets from the same category/type on the same island at the same time.
     * 
     * compared to `singleIslandConcurrentUsage`, this is more strict as it's a category limit, not a single asset limit.
     * 
     * ONLY USABLE FOR assetS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    singleIslandConcurrentCategoryUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of THIS asset can be used in a SINGLE island IN TOTAL.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this asset on the same island (regardless of concurrent usage).
     */
    singleIslandTotalUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of ANY asset within this asset's category/type can be used in a SINGLE island IN TOTAL.
     */
    singleIslandTotalCategoryUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of THIS asset can be used in MULTIPLE islands CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this asset on different islands (it can be 1 on each island, 2 on island #1 and 3 on island #2 and so on).
     * it of course depends on other limitations such as `singleIslandConcurrentUsage`, `singleIslandTotalUsage`, etc.
     * 
     * ONLY USABLE FOR assetS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    multiIslandConcurrentUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of ANY asset within this asset's category/type can be used in MULTIPLE islands CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 assets from the same category/type on different islands at the same time.
     * it of course depends on other limitations such as `singleIslandConcurrentCategoryUsage`, `singleIslandTotalCategoryUsage`, etc.
     * 
     * ONLY USABLE FOR assetS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    multiIslandConcurrentCategoryUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of THIS asset can be used in MULTIPLE islands IN TOTAL.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this asset on different islands (regardless of concurrent usage).
     */
    multiIslandTotalUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of ANY asset within this asset's category/type can be used in MULTIPLE islands IN TOTAL.
     * 
     * for example, if the limit is 5, then the user can use up to 5 assets from the same category/type on different islands.
     */
    multiIslandTotalCategoryUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of THIS asset can be used on a single bit CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this asset on the same bit at the same time.
     * 
     * ONLY USABLE FOR assetS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    singleBitConcurrentUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of ANY asset within this asset's category/type can be used on a single bit CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 assets from the same category/type on the same bit at the same time.
     * 
     * ONLY USABLE FOR assetS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    singleBitConcurrentCategoryUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of THIS asset can be used on a single bit IN TOTAL.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this asset on the same bit (regardless of concurrent usage).
     */
    singleBitTotalUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of ANY asset within this asset's category/type can be used on a single bit IN TOTAL.
     * 
     * for example, if the limit is 5, then the user can use up to 5 assets from the same category/type on the same bit.
     */
    singleBitTotalCategoryUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of THIS asset can be used on MULTIPLE bits CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this asset on different bits (it can be 1 on each bit, 2 on bit #1 and 3 on bit #2 and so on).
     * it of course depends on other limitations such as `singleBitConcurrentUsage`, `singleBitTotalUsage`, etc.
     * 
     * ONLY USABLE FOR assetS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    multiBitConcurrentUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of ANY asset within this asset's category/type can be used on MULTIPLE bits CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 assets from the same category/type on different bits at the same time.
     * it of course depends on other limitations such as `singleBitConcurrentCategoryUsage`, `singleBitTotalCategoryUsage`, etc.
     * 
     * ONLY USABLE FOR assetS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    multiBitConcurrentCategoryUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of THIS asset can be used on MULTIPLE bits IN TOTAL.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this asset on different bits (regardless of concurrent usage).
     */
    multiBitTotalUsage: CraftedAssetLimitationNumerical;
    /**
     * how many of ANY asset within this asset's category/type can be used on MULTIPLE bits IN TOTAL.
     * 
     * for example, if the limit is 5, then the user can use up to 5 assets from the same category/type on different bits.
     */
    multiBitTotalCategoryUsage: CraftedAssetLimitationNumerical;
}

/**
 * Represents a numerical limitation instance of a crafted asset.
 */
export interface CraftedAssetLimitationNumerical {
    /** if the limitation is active. if not, this limitation does NOT apply to the asset. */
    active: boolean;
    /** the limit of the asset's usage */
    limit: number | null;
}

/**
 * Represents the effect values of a crafted asset.
 */
export interface CraftedAssetEffectValues {
    /** which asset is affected by the synthesizing asset upon consumption */
    affectedAsset: 'bit' | 'island';
    /** 
     * the asset's effect duration. 
     * 
     * if `oneTime`, the asset is a one-time use asset (i.e. the effect is applied once and once only).
     * if a number, the asset's effect will last for that number of seconds.
     * 
     * for example, the small totem of energy can last for 1 day (86400 seconds). the isle the totem is applied to will receive a boost
     * in farming rate and decreased energy depletion rate for all placed bits for the entire day.
     */
    effectDuration: 'oneTime' | number;
    /** the increase OR decrease in resource cap of this island.
     * 
     * if `type` is `percentage`, then the `value` is a percentage increase/decrease of the current res cap. 
     * (e.g. if the asset gives 5%, and the current res cap is 1000, it will be increased to 1050. similarly, if -5%, then it will be decreased to 950).
     * 
     * if type is `fixed`, then the `value` is a fixed increase of the current res cap.
     * 
     * if this asset is not meant for islands and thus have no resource cap increase effect, `type` will be null and value will be set to 0.
     */
    resourceCapModifier: {
        /** if this effect is active on this asset */
        active: boolean;
        /** the type of increase */
        type: 'percentage' | 'fixed' | null;
        /** the value to increase or decrease by */
        value: number;
    }
    /**
     * if the asset rerolls the traits of an island.
     */
    rerollIslandTraits: {
        /** if this effect is active on this asset */
        active: boolean;
        /** 
         * the type of reroll.
         * 
         * if `type` is `random`, the system will randomly reroll `value` traits.
         * for example, if `value` is ['Common', 'Uncommon'], the system will randomly reroll the traits for both the common and uncommon resources.
         * 
         * if `type` is `chosen`, the user can choose `value` of traits to reroll. Each trait can be different than another.
         * for example, if `value` is ['Common', 'Uncommon'], then the user can choose to reroll to Aquifer for common resources and Fertile for uncommon, or Mineral Rich and Aquifer, etc. (free choice)
         * 
         * if `type `is `chosenSame`, the user can choose `value` of traits to reroll BUT all traits to reroll MUST be the same.
         * for example, if `value` is ['Common', 'Uncommon'], then the user can ONLY choose to reroll to Aquifer, Fertile OR Mineral Rich for both common and uncommon resources.
         * 
         */
        type: 'random' | 'chosen' | 'chosenSame' | null;
        /**
         * if `allowDuplicates` is true, each rerolled trait can be the same as the original trait (meaning that the original trait is added to the pool of possible traits).
         * 
         * NOTE: this is only used if `type` is `random`.
         */
        allowDuplicates: boolean;
        /**
         * the resource rarities to reroll.
         * 
         * if `all`, then ALL resource rarities will be rerolled.
         * if an array of resource rarities, then only those resource rarities will be rerolled.
         */
        value: ResourceRarity[] | 'all' | null;
    },
    /**
     * increases OR decreases the gathering rate of an island (%), depending on the value specified.
     */
    gatheringRateModifier: {
        /** if this effect is active on this asset */
        active: boolean;
        /** the value to increase or decrease by */
        value: number | null;
    }
    /**
     * increases OR decreases the energy depletion rate of ALL BITS placed within an island (%), depending on the value specified.
     * 
     * if the value is positive, this will increase the depletion rate, making the bits lose energy faster, and vice versa.
     */
    placedBitsEnergyDepletionRateModifier: {
        /** if this effect is active on this asset */
        active: boolean;
        /**
         * if this is `true`, any bits that are placed on the island AFTER this asset is used will also obtain the effect.
         * otherwise, only bits that are placed BEFORE this asset is used will obtain the effect.
         */
        allowLaterPlacedBitsToObtainEffect: boolean;
        /**
         * if this is `true`, any bits that are unplaced from the island AFTER this asset is used will lose the effect.
         * otherwise, they will retain the effect until the asset's effect duration is over (or permanently, depending on the asset's `effectDuration`).
         */
        allowLaterUnplacedBitsToLoseEffect: boolean;
        /** the value to increase or decrease by */
        value: number | null;
    }
    /**
     * if this asset allows a bit to be transferred to another Season (instead of being 'burned').
     */
    bitTransferrableBetweenSeasons: {
        /** if this effect is active on this asset */
        active: boolean;
        /** the season which this bit is allowed to be transferred into (currently it will be 1) */
        value: number | null;
    }
    /**
     * if this asset allows one or more of a bit's traits to be rerolled.
     */
    rerollBitTraits: {
        /** if this effect is active on this asset */
        active: boolean;
        /**
         * the type of rerolling.
         * 
         * if `chosen`, the user can choose `value` of traits to reroll.
         * if `random`, the system will reroll `value` of traits randomly.
         */
        type: 'chosen' | 'random' | null;
        /**
         * the result of the reroll(s).
         * 
         * if `onlyPositive`, then the traits being rerolled will ONLY result in positive traits.
         * if `onlyNegative`, then the traits being rerolled will ONLY result in negative traits.
         * if `random`, then the traits being rerolled will result in random traits (can be positive or negative).
         */
        result: 'onlyPositive' | 'onlyNegative' | 'random' | null;
        /**
         * if `allowDuplicates` is true, each rerolled trait can be the same as the original trait (meaning that the original trait is added to the pool of possible traits).
         * 
         * NOTE: this is only used if `type` is `random`.
         */
        allowDuplicates: boolean;
        /** the amount of traits that can be rerolled. if 'all', all of the bits traits will be rerolled. */
        value: number | 'all' | null;
    }
}

/**
 * The different types of crafting recipe lines.
 */
export enum CraftingRecipeLine {
    /** related to consumables or any basic assets */
    SYNTHESIZING = 'Synthesizing',
    /** related to refining/purification of ore resources */
    SMELTING = 'Smelting',
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
    // partially cancelled is used when a portion of the craft is cancelled, but some of the assets have already been produced (but the claimable amount is already claimed).
    PARTIALLY_CANCELLED = 'Partially Cancelled',
    // the state before 'Partially Cancelled' where the user can claim the assets that have been produced so far upon cancelling the remaining craft.
    PARTIALLY_CANCELLED_CLAIMABLE = 'Partially Cancelled (Claimable)',
    CANCELLED = 'Cancelled',
}

/**
 * Represents a craftable asset.
 */
export type CraftableAsset = AugmentationItem | TransmutationItem | EnergyTotemItem | ContinuumRelicItem | PotionItem | IngotItem;

/**
 * A list of different Synthesizing item groups.
 */
export enum SynthesizingItemGroup {
    AUGMENTATION_ITEM = 'Augmentation Item',
    TRANSMUTATION_ITEM = 'Transmutation Item',
    ENERGY_TOTEM_ITEM = 'Energy Totem Item',
    CONTINUUM_RELIC_ITEM = 'Continuum Relic Item',
    POTION_ITEM = 'Potion Item',
}
