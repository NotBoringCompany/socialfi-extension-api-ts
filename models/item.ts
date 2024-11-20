/****************
 * ITEM-RELATED MODELS
 ****************/
import { BitRarity } from './bit';
import { BoosterItem } from './booster';
import { BitCosmetic } from './cosmetic';
import { IslandType } from './island';
import { ResourceLine, ResourceRarity } from './resource';

/**
 * Represents an item.
 */
export interface Item {
    /** the type of item */
    type: ItemType;
    /** 
     * the amount of item (used only for methods that require amount, such as for rewards or in the inventory) 
     * 
     * this includes both mintable and non-mintable amounts combined.
     */
    amount?: number;
    /**
     * the amount from `amount` of this item that can be minted as SFTs.
     */
    mintableAmount?: number;
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
WonderspinTicketType | 
BitOrbType | 
TerraCapsulatorType | 
WonderArtefactItem | 
SynthesizingItem |
SmeltingItem;

/**
 * Represents all ticket types for the Wonderspin.
 */
export enum WonderspinTicketType {
    STANDARD_WONDERSPIN_TICKET_I = 'Standard Wonderspin Ticket (I)',
    STANDARD_WONDERSPIN_TICKET_II = 'Standard Wonderspin Ticket (II)',
    PREMIUM_WONDERSPIN_TICKET = 'Premium Wonderspin Ticket',
}

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
 * a runtime-populated object representing wonder artefact items.
 * each key is a unique wonder artefact item name, and each value is the same wonder artefact item name as a string,
 * allowing it to behave similarly to a typescript enum.
 */
export const WonderArtefactEnum: { [key: string]: string } = {}

/**
 * a runtime-populated object representing augmentation items.
 * each key is a unique augmentation item name, and each value is the same augmentation item name as a string,
 * allowing it to behave similarly to a typescript enum.
 */
export const AugmentationEnum: { [key: string]: string } = {}

/**
 * a runtime-populated object representing transmutation items.
 * each key is a unique transmutation item name, and each value is the same transmutation item name as a string,
 * allowing it to behave similarly to a typescript enum.
 */
export const TransmutationEnum: { [key: string]: string } = {}

/**
 * a runtime-populated object representing energy totem items.
 * each key is a unique energy totem item name, and each value is the same energy totem item name as a string,
 * allowing it to behave similarly to a typescript enum.
 */
export const EnergyTotemEnum: { [key: string]: string } = {}

/**
 * a runtime-populated object representing continuum relic items.
 * each key is a unique continuum relic item name, and each value is the same continuum relic item name as a string,
 * allowing it to behave similarly to a typescript enum.
 */
export const ContinuumRelicEnum: { [key: string]: string } = {}

/**
 * a runtime-populated object representing potion items.
 * each key is a unique potion item name, and each value is the same potion item name as a string,
 * allowing it to behave similarly to a typescript enum.
 */
export const PotionEnum: { [key: string]: string } = {}

/**
 * a runtime-populated object representing ingot items (that are refined from resource ores).
 * each key is a unique potion item name, and each value is the same potion item name as a string,
 * allowing it to behave similarly to a typescript enum.
 */
export const IngotEnum: { [key: string]: string } = {}

/**
 * represents the type of a wonder artefact key from `WonderArtefactEnum`,
 * acting as a union of all valid wonder artefact names once populated at runtime.
 * this allows `WonderArtefactItem` to behave similarly to an enum type.
 */
export type WonderArtefactItem = Extract<keyof typeof WonderArtefactEnum, string>;

/**
 * represents the type of an augmentation key from `AugmentationEnum`,
 * acting as a union of all valid augmentation names once populated at runtime.
 * this allows `AugmentationItem` to behave similarly to an enum type.
 */
export type AugmentationItem = Extract<keyof typeof AugmentationEnum, string>;

/**
 * represents the type of a transmutation key from `TransmutationEnum`,
 * acting as a union of all valid transmutation names once populated at runtime.
 * this allows `TransmutationItem` to behave similarly to an enum type.
 */
export type TransmutationItem = Extract<keyof typeof TransmutationEnum, string>;

/**
 * represents the type of an energy totem key from `EnergyTotemEnum`,
 * acting as a union of all valid energy totem names once populated at runtime.
 * this allows `EnergyTotemItem` to behave similarly to an enum type.
 */
export type EnergyTotemItem = Extract<keyof typeof EnergyTotemEnum, string>;

/**
 * represents the type of a continuum relic key from `ContinuumRelicEnum`,
 * acting as a union of all valid continuum relic names once populated at runtime.
 * this allows `ContinuumRelicItem` to behave similarly to an enum type.
 */
export type ContinuumRelicItem = Extract<keyof typeof ContinuumRelicEnum, string>;

/**
 * represents the type of a potion key from `PotionEnum`,
 * acting as a union of all valid potion names once populated at runtime.
 * this allows `PotionItem` to behave similarly to an enum type.
 */
export type PotionItem = Extract<keyof typeof PotionEnum, string>;

/**
 * represents the type of an ingot key from `IngotEnum`,
 * acting as a union of all valid ingot names once populated at runtime.
 * this allows `IngotItem` to behave similarly to an enum type.
 */
export type IngotItem = Extract<keyof typeof IngotEnum, string>;

/**
 * Represents items that are made via the Synthesizing crafting line.
 */
export type SynthesizingItem = AugmentationItem | TransmutationItem | EnergyTotemItem | ContinuumRelicItem | PotionItem;

/**
 * Represents items that are made via the Smelting crafting line.
 */
export type SmeltingItem = IngotItem;

/**
 * Represents the data for a consumed synthesizing item.
 */
export interface ConsumedSynthesizingItem {
    /** the database ID */
    _id: string;
    /** the user's database ID (who used this item) */
    usedBy: string;
    /** the item name */
    item: SynthesizingItem;
    /** the affected asset (bit or island) */
    affectedAsset: 'bit' | 'island';
    /** the island or bit id that the item was applied to */
    islandOrBitId?: number;
    /** when the item was consumed */
    consumedTimestamp: number;
    /**
     * until when the item effect will last.
     * 
     * NOTE: if the item's `effectDuration` is `oneTime`, this will be the same as `consumedTimestamp`.
     */
    effectUntil: number; 
}