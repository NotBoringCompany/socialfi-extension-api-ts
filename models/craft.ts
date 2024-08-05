import { ExtendedResource, ResourceRarity, ResourceType, SimplifiedResource } from "./resource";

export interface Crafting {
    catalysts: SimplifiedResource[],
    resultItem : ExtendedResource,
    rarity : ResourceRarity
}

export interface CraftItem {
    /** the type of crafting */
    //type: CraftType;
    type: ResourceType;

    /** the craft item line */

    line: CraftItemLine;

    /** the rarity of the craft item */

    rarity: CraftItemRarity;

    /** the energy required to create 1 of this resource (singular weight) */

    baseEnergy: number;

    /** resource required to create 1 of this resource */
    berries:number,
    catalyst: SimplifiedResource[],
    baseSuccessChance: number,
    baseCritChance: number,
    points: number,
    craftPoints: number,
    reqLevel: number,
    reqCraftLevel: number,
    craftExp: number,
    weight: number
}

export interface CraftResultItem {
    /** the type of crafting */
    //type: CraftType;
    type: CraftType;
    /** the craft item line */
    line: CraftItemLine;
    /** the rarity of the craft item */
    rarity: CraftItemRarity;
    /** the energy required to create 1 of this resource (singular weight) */
    baseEnergy: number;
    /** Berry required to create 1 of this resource */
    berries:number,
    /** resource required to create 1 of this resource */
    catalyst: SimplifiedResource[],
    /** Success Rate to create 1 of this item */
    baseSuccessChance: number,
    /** Crit chance to create more of this item */
    baseCritChance: number,
    /** Points generated  */
    points: number,
    /** Craft points given after creating 1 of this item */
    craftPoints: number,
    /** Required level to create 1 of this item */
    reqLevel: number,
    /** Required Craft level to create 1 of this item */
    reqCraftLevel: number,
    /** Craft exp given after creating 1 of this item */
    craftExp: number,
    /** weight of the resulted item (but i think we can search from the resourceDB) */
    weight: number
}

export enum CraftRecipes
{
    MAPLE_SYRUP = "HIGH QUALITY MAPLE SYRUP",
    GOLD = "HIGH QUALITY GOLD",
    SILVER = "HIGH QUALITY SILVER"
}

export enum SmeltingCraft
{
    PURIFIED_STONE = "PURIFIED STONE",
    PURIFIED_IRON = "PURIFIED IRON",
    PURIFIED_SILVER = "PURIFIED SILVER",
    PURIFIED_GOLD = "PURIFIED GOLD",
    PLATINUM_TEAR = "PLATINUM TEAR"
}

export enum CookingCraft
{
    
    REFRESHING_MELON = "REFRESHING MELON",
    ROYAL_JELLY = "ROYAL JELLY",
    HONEYDEW = "HONEYDEW",
    SALAD = "SALAD",
    SUGAR_RUSH = "SUGAR RUSH",
    SWEET_DRAGON = "SWEET DRAGON",
    GOLD_SYRUP = "GOLD SYRUP",
}

export enum CarpentingCraft
{
    BRICKSTONE_WOOD = "BRICKSTONE WOOD",
    BOLD_BRANCH = "BOLD BRANCH",
    ADAM_WOOD = "ADAM WOOD",
    ROOT_OF_EVE = "ROOT OF EVE",

}

export enum TailoringCraft
{
    SHINING_FABRIC = "SHINING FABRIC",
    GOLDEN_THREAD = "GOLDEN THREAD",
    DENIM = "DENIM",
    SATIN = "SATIN"
}


/**
 * Represents the resource's line.
 */
export enum CraftItemLine {
    SMELTING = 'Smelting',
    COOKING = 'Cooking',
    CARPENTING = 'Carpenting',
    TAILORING = 'Tailoring',
}

/** 
 * Represents the resource's rarity 
 */
export enum CraftItemRarity {
    COMMON = 'Common',
    UNCOMMON = 'Uncommon',
    RARE = 'Rare',
    EPIC = 'Epic',
    LEGENDARY = 'Legendary',
}

/** Numeric representation of `ResourceRarity` */
export const CraftItemRarityNumeric: { [key in ResourceRarity]: number } = {
    [CraftItemRarity.COMMON]: 0,
    [CraftItemRarity.UNCOMMON]: 1,
    [CraftItemRarity.RARE]: 2,
    [CraftItemRarity.EPIC]: 3,
    [CraftItemRarity.LEGENDARY]: 4,
}

export type CraftType = SmeltingCraft | CookingCraft | CarpentingCraft | TailoringCraft;

/* 

    public class recipe
    {
        public List<ExtendedItem> catalyst;
        public Item resultItem;
    }

    public class ExtendedItem
    {
        public Item item;
        public int amount;
    }
    

*/