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
        const result = await BitModel.updateOne({ bitId, 'ownerData.currentOwnerId': owner }, {
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
 * Gets the enum type of `item`. For example, if inputted `Parchment of Restoration`, it will return `Restoration Item`.
 */
export const GET_SYNTHESIZING_ITEM_TYPE = (item: string): SynthesizingItemGroup | undefined => {
    if (Object.values(AugmentationEnum).includes(item as AugmentationItem)) {
        return SynthesizingItemGroup.AUGMENTATION_ITEM;
    }

    // if (Object.values(TransmutationEnum).includes(item as TransmutationItem)) {
    //     return SynthesizingItemGroup.TRANSMUTATION_ITEM;
    // }

    // if (Object.values(EnergyTotemEnum).includes(item as EnergyTotemItem)) {
    //     return SynthesizingItemGroup.ENERGY_TOTEM_ITEM;
    // }

    // if (Object.values(ContinuumRelicEnum).includes(item as ContinuumRelicItem)) {
    //     return SynthesizingItemGroup.CONTINUUM_RELIC_ITEM;
    // }

    // if (Object.values(PotionEnum).includes(item as PotionItem)) {
    //     return SynthesizingItemGroup.POTION_ITEM;
    // }

    return undefined;
}

/**
 * Maps each `SynthesizingItemGroup` to its corresponding enum.
 */
export const SYNTHESIZING_ITEM_ENUM_MAP: { [ key in SynthesizingItemGroup]: object } = {
    [SynthesizingItemGroup.AUGMENTATION_ITEM]: AugmentationEnum,
    [SynthesizingItemGroup.REROLLING_POTION_ITEM]: AugmentationEnum,
    // [SynthesizingItemGroup.TRANSMUTATION_ITEM]: TransmutationEnum,
    // [SynthesizingItemGroup.ENERGY_TOTEM_ITEM]: EnergyTotemEnum,
    // [SynthesizingItemGroup.CONTINUUM_RELIC_ITEM]: ContinuumRelicEnum,
    // [SynthesizingItemGroup.POTION_ITEM]: PotionEnum,
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