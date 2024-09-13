/****************
 * ITEM-RELATED MODELS
 ****************/
import { BoosterItem } from './booster';

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
RestorationItem | 
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
 * A list of different Restoration items.
 */
export enum RestorationItem {
    PARCHMENT_OF_RESTORATION = 'Parchment of Restoration',
    SCROLL_OF_RESTORATION = 'Scroll of Restoration',
    TOME_OF_RESTORATION = 'Tome of Restoration',
    ANCIENT_SCROLL_OF_RESTORATION = 'Ancient Scroll of Restoration',
    ANCIENT_TOME_OF_RESTORATION = 'Ancient Tome of Restoration',
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