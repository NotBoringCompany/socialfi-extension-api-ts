import { Asset } from '../../models/asset';
import { BitRarity } from '../../models/bit';
import { SynthesizingItemGroup } from '../../models/craft';
import { IslandType } from '../../models/island';
import { AugmentationItem, BitOrbType, ContinuumRelicItem, EnergyTotemItem, Item, PotionItem, SynthesizingItem, TerraCapsulatorType, TransmutationItem } from '../../models/item';
import { BarrenResource, FruitResource, LiquidResource, OreResource } from '../../models/resource';

/**
 * Represents the list of assets available in our game.
 */
export const assets: Asset[] = [
    {
        type: BarrenResource.SEAWEED,
        description: 'Underwater foliage with various uses, but watch out for its clingy tendencies!'
    },
    {
        type: OreResource.STONE,
        description: 'A solid and sturdy rock.'
    },
    {
        type: FruitResource.TOMATO,
        description: 'Little bursts of blue sweetness in every bite.'
    },
    {
        type: LiquidResource.WATER,
        description: 'An essential clear and refreshing liquid.'
    },
    {
        type: OreResource.COPPER,
        description: 'A soft and malleable metal.'
    },
    {
        type: FruitResource.APPLE,
        description: 'Crunchy, crispy and juicy.'
    },
    {
        type: LiquidResource.MAPLE_SYRUP,
        description: 'Golden and sweet, perfect for pancakes.'
    },
    {
        type: OreResource.IRON,
        description: 'A strong and durable metal.'
    },
    {
        type: FruitResource.STAR_FRUIT,
        description: 'A tropical fruit with a unique shape.'
    },
    {
        type: LiquidResource.HONEY,
        description: 'Thank the bees for crafting this sweet treat.'
    },
    {
        type: OreResource.SILVER,
        description: 'Shiny and precious.'
    },
    {
        type: FruitResource.MELON,
        description: 'Juicy and refreshing for sunny days.'
    },
    {
        type: LiquidResource.MOONLIGHT_DEW,
        description: 'Sparkly drops from the night sky.'
    },
    {
        type: OreResource.GOLD,
        description: 'A shiny metal for a shiny dream.'
    },
    {
        type: FruitResource.DRAGON_FRUIT,
        description: 'Vibrant, exotic and most importantly yummy.'
    },
    {
        type: LiquidResource.PHOENIX_TEAR,
        description: 'Heals like a warm hug from a mythical bird.'
    },
    {
        type: TerraCapsulatorType.TERRA_CAPSULATOR_I,
        description: 'This mysterious capsule summons a mysterious island at your disposal.'
    },
    {
        type: TerraCapsulatorType.TERRA_CAPSULATOR_II,
        description: 'This mysterious capsule summons a mysterious island at your disposal. Higher chances of getting higher rarity islands.'
    },
    {
        type: TerraCapsulatorType.TERRA_CAPSULATOR_I,
        description: 'This mysterious capsule summons a mysterious island at your disposal. Highest chances of getting higher rarity islands.'
    },
    {
        type: BitOrbType.BIT_ORB_I,
        description: 'A shiny orb that holds the power of your own companion.'
    },
    {
        type: BitOrbType.BIT_ORB_II,
        description: 'A shiny orb that holds the power of your own companion. Higher chances of getting higher rarity Bits.'
    },
    {
        type: BitOrbType.BIT_ORB_III,
        description: 'A shiny orb that holds the power of your own companion. Highest chances of getting higher rarity Bits.'
    }
]

/**
 * Gets the enum type of `item`. For example, if inputted `Parchment of Restoration`, it will return `Restoration Item`.
 */
export const GET_SYNTHESIZING_ITEM_TYPE = (item: string): SynthesizingItemGroup | undefined => {
    if (Object.values(AugmentationItem).includes(item as AugmentationItem)) {
        return SynthesizingItemGroup.AUGMENTATION_ITEM;
    }

    if (Object.values(TransmutationItem).includes(item as TransmutationItem)) {
        return SynthesizingItemGroup.TRANSMUTATION_ITEM;
    }

    if (Object.values(EnergyTotemItem).includes(item as EnergyTotemItem)) {
        return SynthesizingItemGroup.ENERGY_TOTEM_ITEM;
    }

    if (Object.values(ContinuumRelicItem).includes(item as ContinuumRelicItem)) {
        return SynthesizingItemGroup.CONTINUUM_RELIC_ITEM;
    }

    if (Object.values(PotionItem).includes(item as PotionItem)) {
        return SynthesizingItemGroup.POTION_ITEM;
    }

    return undefined;
}

/**
 * Represents the data for synthesizing items crafted via the Synthesizing crafting line, such as its effects.
 */
export interface SynthesizingItemData {
    /**
     * the item's name.
     */
    name: SynthesizingItem;
    /**
     * the item's description.
     */
    description: string;
    /**
     * if the item requires a minimum rarity to be used on an island or a bit.
     */
    minimumRarity: IslandType | BitRarity | null;
    /**
     * the item's limitations (e.g. the max limit of this item usable on an island, etc.)
     */
    limitations: SynthesizingItemLimitations;
    /** 
     * the effect values.
     */
    effectValues: SynthesizingItemEffectValues;
}

/**
 * Represents a numerical limitation instance of a synthesizing item.
 */
export interface SynthesizingItemLimitationNumerical {
    /** if the limitation is active. if not, this limitation does NOT apply to the item. */
    active: boolean;
    /** the limit of the item's usage */
    limit: number | null;
}

/**
 * Represents the limitations of a synthesizing item.
 */
export interface SynthesizingItemLimitations {
    /** if this item has a usage limit per island (i.e. how many of this item can be used on a single island) */
    singleIslandUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of this item can be used on multiple islands concurrently. for example, if the limit is 5, and the `islandUsage.limit` is 1,
     * then the item can be used UP TO 5 islands at the same time, but only 1 on each island.
     */
    concurrentIslandsUsage: SynthesizingItemLimitationNumerical;
    /** if this item has a usage limit per bit (i.e. how many of this item can be used on a single bit) */
    singleBitUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of this item can be used on multiple bits concurrently. for example, if the limit is 5, and the `bitUsage.limit` is 1,
     * then the item can be used UP TO 5 bits at the same time, but only 1 on each bit.
     */
    concurrentBitsUsage: SynthesizingItemLimitationNumerical;
    /** if this item can be used while another of the same item is currently active (used) */
    usableWhenAnotherSameItemActive: boolean;
}

/**
 * Represents the effect values of a synthesizing item.
 */
export interface SynthesizingItemEffectValues {
    /** which asset is affected by the synthesizing item upon consumption */
    affectedAsset: 'bit' | 'island';
    /** the increase in resource cap of this island.
     * 
     * if `type` is `percentage`, then the `amount` is a percentage increase of the current res cap. 
     * (e.g. if the item gives 5%, and the current res cap is 1000, it will be increased to 1050.)
     * 
     * if type is `fixed`, then the `amount` is a fixed increase of the current res cap.
     */
    resourceCapIncrease: {
        type: 'percentage' | 'fixed';
        amount: number;
    }
}