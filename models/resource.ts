/****************
 * RESOURCE-RELATED MODELS
 ****************/

/**
 * Represents a resource.
 * 
 * Since this is not an SFT/NFT yet, we don't associate a single resource with an ID, but rather treat it as a quantitative asset.
 */
export interface Resource {
    /** the type of resource */
    type: ResourceType;
    /** the resource line */
    line: ResourceLine;
    /** the rarity of the resource */
    rarity: ResourceRarity;
    /** the weight of 1 of this resource (singular weight) */
    weight: number;
}

/**
 * Represents a resource with an amount of that resource.
 * 
 * Used primarily in claimable resources and the user's inventory.
 * 
 * Cumulative weight is not calculated here.
 */
export interface ExtendedResource extends Resource {
    /** the amount of this resource */
    amount: number;
}

/**
 * Represents the resource's line.
 */
export enum ResourceLine {
    BARREN = 'Barren',
    ORE = 'Ore',
    FRUIT = 'Fruit',
    LIQUID = 'Liquid',
}

/** 
 * Represents the resource's rarity 
 */
export enum ResourceRarity {
    COMMON = 'Common',
    UNCOMMON = 'Uncommon',
    RARE = 'Rare',
    EPIC = 'Epic',
    LEGENDARY = 'Legendary',
}

/**
 * Lists all barren resources from common-legendary.
 */
export enum BarrenResource {
    SEAWEED = 'Seaweed',
}

/**
 * Lists all ore resources from common-legendary.
 */
export enum OreResource {
    STONE = 'Stone',
    COPPER = 'Copper',
    IRON = 'Iron',
    SILVER = 'Silver',
    GOLD = 'Gold',
}

/**
 * Lists all fruit resources from common-legendary.
 */
export enum FruitResource {
    BLUEBERRY = 'Blueberry',
    APPLE = 'Apple',
    STAR_FRUIT = 'Star Fruit',
    MELON = 'Melon',
    DRAGON_FRUIT = 'Dragon Fruit',
}

/**
 * Lists all liquid resources from common-legendary.
 */
export enum LiquidResource {
    WATER = 'Water',
    MAPLE_SYRUP = 'Maple Syrup',
    HONEY = 'Honey',
    MOONLIGHT_DEW = 'Moonlight Dew',
    PHOENIX_TEAR = 'Phoenix Tear',
}

/** 
 * Represents a resource type based on all possible resources.
 */
export type ResourceType = BarrenResource | OreResource | FruitResource | LiquidResource;