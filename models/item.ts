/****************
 * ITEM-RELATED MODELS
 ****************/
import { BitRarity } from './bit';
import { BoosterItem } from './booster';
import { IslandType } from './island';

/**
 * Represents an item.
 */
export interface Item {
    /** the type of item */
    type: ItemType;
    /** the amount of item (used only for methods that require amount, such as for rewards or in the inventory) */
    amount?: number;
    /** the amount of this item consumed by the user (used only for methods that require amount, such as for rewards or in the inventory) */
    totalAmountConsumed?: number;
    /** 
     * the amount of this item consumed by the user in a week (used only for methods that require amount, such as for rewards or in the inventory) 
     * 
     * gets reset by a scheduler weekly at 23:59 UTC sunday.
     */
    weeklyAmountConsumed?: number;
}

/**
 * Represents the type of item, which are generic assets that are usable in-game.
 */
export type ItemType = 
BoosterItem | 
BitOrbType | 
TerraCapsulatorType | 
WonderArtefactItem | 
AugmentationItem | 
TransmutationItem | 
EnergyTotemItem | 
ContinuumRelicItem | 
PotionItem |
IngotItem;

/**
 * Represents all Bit Orb types in the game.
 */
export enum BitOrbType {
    BIT_ORB_I = 'Bit Orb (I)',
    BIT_ORB_II = 'Bit Orb (II)',
    BIT_ORB_III = 'Bit Orb (III)'
}

/**
 * Represents all Terra Capsulator types in the game.
 */
export enum TerraCapsulatorType {
    TERRA_CAPSULATOR_I = 'Terra Capsulator (I)',
    TERRA_CAPSULATOR_II = 'Terra Capsulator (II)'
}

/**
 * Represents all Wonder Artefact items.
 */
export enum WonderArtefactItem {
    ESSENCE_OF_WONDER = 'Essence of Wonder',
    LIGHT_OF_WONDER = 'Light of Wonder',
}

/**
 * A list of different Augmentation items.
 */
export enum AugmentationItem {
    PARCHMENT_OF_AUGMENTATION = 'Parchment of Augmentation',
    SCROLL_OF_AUGMENTATION = 'Scroll of Augmentation',
    TOME_OF_AUGMENTATION = 'Tome of Augmentation',
    ANCIENT_SCROLL_OF_AUGMENTATION = 'Ancient Scroll of Augmentation',
    ANCIENT_TOME_OF_AUGMENTATION = 'Ancient Tome of Augmentation',
}

/**
 * A list of different Transmutation items.
 */
export enum TransmutationItem {
    WAND_OF_TRANSMUTATION = 'Wand of Transmutation',
    STAFF_OF_TRANSMUTATION = 'Staff of Transmutation',
    ROYAL_SCEPTER_OF_TRANSMUTATION = 'Royal Scepter of Transmutation',
}

/**
 * A list of different craftable Energy Totem items.
 */
export enum EnergyTotemItem {
    SMALL_TOTEM_OF_ENERGY = 'Small Totem of Energy',
    BIG_TOTEM_OF_ENERGY = 'Big Totem of Energy',
    GRAND_TOTEM_OF_ENERGY = 'Grand Totem of Energy',
}

/**
 * A list of different Continuum Relic items.
 */
export enum ContinuumRelicItem {
    FADED_CONTINUUM_RELIC = 'Faded Continuum Relic',
    GLEAMING_CONTINUUM_RELIC = 'Gleaming Continuum Relic',
    MYTHIC_CONTINUUM_RELIC = 'Mythic Continuum Relic',
}

/**
 * A list of different Potion items.
 */
export enum PotionItem {
    POTION_OF_LUCK = 'Potion of Luck',
    POTION_OF_ENLIGHTENMENT = 'Potion of Enlightenment',
    POTION_OF_DIVINE_ENLIGHTENMENT = 'Potion of Divine Enlightenment',
}

/**
 * A list of different ingots that are refined from resource ores.
 */
export enum IngotItem {
    COPPER_INGOT = 'Copper Ingot',
    IRON_INGOT = 'Iron Ingot',
    SILVER_INGOT = 'Silver Ingot',
    GOLD_INGOT = 'Gold Ingot'
}

/**
 * Represents items that are made via the Synthesizing crafting line.
 */
export type SynthesizingItem = AugmentationItem | TransmutationItem | EnergyTotemItem | ContinuumRelicItem | PotionItem;

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
 * Represents a numerical limitation instance of a synthesizing item.
 */
export interface SynthesizingItemLimitationNumerical {
    /** if the limitation is active. if not, this limitation does NOT apply to the item. */
    active: boolean;
    /** the limit of the item's usage */
    limit: number | null;
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
     * 
     * if this item is not meant for islands and thus have no resource cap increase effect, `type` will be null and amount will be set to 0.
     */
    resourceCapIncrease: {
        /** the type of increase */
        type: 'percentage' | 'fixed' | null;
        /** the amount of increase */
        amount: number;
    }
}