import Bull from 'bull';
import { Asset } from '../../models/asset';
import { BitRarity } from '../../models/bit';
import { SynthesizingItemGroup } from '../../models/craft';
import { IslandType } from '../../models/island';
import { AugmentationEnum, AugmentationItem, BitOrbType, ContinuumRelicEnum, ContinuumRelicItem, EnergyTotemEnum, EnergyTotemItem, Item, PotionEnum, PotionItem, SynthesizingItem, TerraCapsulatorType, TransmutationEnum, TransmutationItem } from '../../models/item';
import { BarrenResource, FruitResource, LiquidResource, OreResource } from '../../models/resource';
import { BitModel, IslandModel } from './db';
import { Modifier } from '../../models/modifier';

/**
 * Creates a new queue to add or remove consumed synthesizing item effects from other assets.
 */
export const SYNTHESIZING_ITEM_EFFECT_REMOVAL_QUEUE = new Bull('synthesizingItemEffectRemovalQueue', {
    redis: process.env.REDIS_URL
});

/**
 * Remove any expired gathering rate modifier effects from a consumed synthesizing item.
 */
SYNTHESIZING_ITEM_EFFECT_REMOVAL_QUEUE.process('removeIslandGatheringRateModifier', async (job) => {
    const { islandId, owner, origin, endTimestamp } = job.data;

    try {
        // directly remove gathering rate modifier with the given `origin` from the island
        const result = await IslandModel.updateOne({ islandId, owner }, {
            $pull: {
                'islandStatsModifiers.gatheringRateModifiers': { origin }
            }
        });

        if (result.modifiedCount === 0) {
            throw new Error(`No gathering rate modifier found for island ${islandId} from ${origin}`);
        }
    } catch (err: any) {
        console.error(`Error removing gathering rate modifier effect from island ${islandId} from ${origin}: ${err.message}`);
    }
});

/**
 * Remove any expired energy rate modifier effects for placed bits from a consumed synthesizing item.
 */
SYNTHESIZING_ITEM_EFFECT_REMOVAL_QUEUE.process('removeBitEnergyDepletionRateModifier', async (job) => {
    const { bitId, islandId, owner, origin, endTimestamp } = job.data;

    try {
        // directly remove energy depletion rate modifier with the given `origin` from the bit
        const result = await BitModel.updateOne({ bitId, owner }, {
            $pull: {
                'bitStatsModifiers.energyRateModifiers': { origin }
            }
        });

        if (result.modifiedCount === 0) {
            throw new Error(`No energy depletion rate modifier found for bit ${bitId} from ${origin}`);
        }
    } catch (err: any) {
        console.error(`Error removing energy depletion rate modifier effect from bit ${bitId} from ${origin}: ${err.message}`);
    }
});

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
    },
    {
        type: AugmentationEnum.PARCHMENT_OF_AUGMENTATION,
        description: `Select an Isle (Exotic rarity or below) and increase its resource cap by 1%.`,
    },
    {
        type: AugmentationEnum.SCROLL_OF_AUGMENTATION,
        description: `Select an Isle (Exotic rarity or below) and increase its resource cap by 3%.`,
    },
    {
        type: AugmentationEnum.TOME_OF_AUGMENTATION,
        description: `Select an Isle (Exotic rarity or below) and increase its resource cap by 7%.`,
    },
    {
        type: AugmentationEnum.ANCIENT_SCROLL_OF_AUGMENTATION,
        description: `Select an Isle (any rarity) and increase its resource cap by 10%.`,
    },
    {
        type: AugmentationEnum.ANCIENT_TOME_OF_AUGMENTATION,
        description: `Select an Isle (any rarity) and increase its resource cap by 20%.`,
    },
    {
        type: TransmutationEnum.WAND_OF_TRANSMUTATION,
        description: `Select an Isle (Exotic rarity or below) and randomly transmute all of the Isle's current traits.`,
    },
    {
        type: TransmutationEnum.STAFF_OF_TRANSMUTATION,
        description: `Select an Isle (any rarity) and randomly transmute all of the Isle's current traits.`,
    },
    {
        type: TransmutationEnum.ROYAL_SCEPTER_OF_TRANSMUTATION,
        description: `Select an Isle (any rarity) and choose a trait to transmute all of the Isle's current traits into.`,
    },
    {
        type: EnergyTotemEnum.SMALL_TOTEM_OF_ENERGY,
        description: `Select an Isle and receive +2.5% Isle farming rate & -12.5% energy consumption for all bits there.`,
    },
    {
        type: EnergyTotemEnum.BIG_TOTEM_OF_ENERGY,
        description: `Select an Isle and receive +5% Isle farming rate & -25% energy consumption for all bits there.`,
    },
    {
        type: EnergyTotemEnum.GRAND_TOTEM_OF_ENERGY,
        description: `Select an Isle and receive +7.5% Isle farming rate & -50% energy consumption for all bits there.`,
    },
    {
        type: ContinuumRelicEnum.FADED_CONTINUUM_RELIC,
        description: `Select a Bit (rare rarity or below) and allow transfer to Season 1.`,
    },
    {
        type: ContinuumRelicEnum.GLEAMING_CONTINUUM_RELIC,
        description: `Select a Bit (epic rarity or below) and allow transfer to Season 1.`,
    },
    {
        type: ContinuumRelicEnum.MYTHIC_CONTINUUM_RELIC,
        description: `Select a Bit (any rarity) and allow transfer to Season 1.`,
    },
    {
        type: PotionEnum.POTION_OF_LUCK,
        description: `Select a Bit and reroll one trait randomly.`,
    },
    {
        type: PotionEnum.POTION_OF_ENLIGHTENMENT,
        description: `Select a Bit and reroll all traits randomly.`,
    },
    {
        type: PotionEnum.POTION_OF_UNHOLY_ENLIGHTENMENT,
        description: `Select a Bit and select one trait to reroll randomly. A positive trait and no duplicate guaranteed.`,
    },
    {
        type: PotionEnum.POTION_OF_DIVINE_ENLIGHTENMENT,
        description: `Select a Bit and reroll all traits randomly. Positive traits and no duplicates guaranteed.`,
    }
]

/**
 * Gets the enum type of `item`. For example, if inputted `Parchment of Restoration`, it will return `Restoration Item`.
 */
export const GET_SYNTHESIZING_ITEM_TYPE = (item: string): SynthesizingItemGroup | undefined => {
    if (Object.values(AugmentationEnum).includes(item as AugmentationItem)) {
        return SynthesizingItemGroup.AUGMENTATION_ITEM;
    }

    if (Object.values(TransmutationEnum).includes(item as TransmutationItem)) {
        return SynthesizingItemGroup.TRANSMUTATION_ITEM;
    }

    if (Object.values(EnergyTotemEnum).includes(item as EnergyTotemItem)) {
        return SynthesizingItemGroup.ENERGY_TOTEM_ITEM;
    }

    if (Object.values(ContinuumRelicEnum).includes(item as ContinuumRelicItem)) {
        return SynthesizingItemGroup.CONTINUUM_RELIC_ITEM;
    }

    if (Object.values(PotionEnum).includes(item as PotionItem)) {
        return SynthesizingItemGroup.POTION_ITEM;
    }

    return undefined;
}

/**
 * Maps each `SynthesizingItemGroup` to its corresponding enum.
 */
export const SYNTHESIZING_ITEM_ENUM_MAP: { [ key in SynthesizingItemGroup]: object } = {
    [SynthesizingItemGroup.AUGMENTATION_ITEM]: AugmentationEnum,
    [SynthesizingItemGroup.TRANSMUTATION_ITEM]: TransmutationEnum,
    [SynthesizingItemGroup.ENERGY_TOTEM_ITEM]: EnergyTotemEnum,
    [SynthesizingItemGroup.CONTINUUM_RELIC_ITEM]: ContinuumRelicEnum,
    [SynthesizingItemGroup.POTION_ITEM]: PotionEnum,
}


/**
 * Fetches all enum members of the item type.
 * 
 * For example, if input is `Parchment of Augmentation`, it returns the enum members of `AugmentationEnum`.
 */
export const GET_SYNTHESIZING_ITEM_MEMBERS = (item: string): string[] | undefined => {
    const itemType = GET_SYNTHESIZING_ITEM_TYPE(item);

    if (itemType) {
        const itemEnum = SYNTHESIZING_ITEM_ENUM_MAP[itemType];
        return Object.values(itemEnum) as string[];
    }

    return undefined;
}