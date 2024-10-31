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
WonderspinTicketType | 
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
    POTION_OF_UNHOLY_ENLIGHTENMENT = 'Potion of Unholy Enlightenment',
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
     * if the item to be used has a minimum rarity requirement for the island or bit it is used on.
     */
    minimumRarity: IslandType | BitRarity | null;
    /**
     * if the item to be used has a maximum rarity requirement for the island or bit it is used on.
     */
    maximumRarity: IslandType | BitRarity | null;
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
    /**
     * if this item can be applied on an empty island.
     * 
     * only applicable for items that have effects on islands (otherwise it SHOULD be set to true anyway).
     */
    applicableOnEmptyIsland: boolean;
    /**
     * how many of THIS item can be used in a single island CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this item on the same island at the same time.
     * 
     * ONLY USABLE FOR ITEMS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    singleIslandConcurrentUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of ANY item within this item's category/type can be used in a single island CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 items from the same category/type on the same island at the same time.
     * 
     * compared to `singleIslandConcurrentUsage`, this is more strict as it's a category limit, not a single item limit.
     * 
     * ONLY USABLE FOR ITEMS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    singleIslandConcurrentCategoryUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of THIS item can be used in a SINGLE island IN TOTAL.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this item on the same island (regardless of concurrent usage).
     */
    singleIslandTotalUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of ANY item within this item's category/type can be used in a SINGLE island IN TOTAL.
     */
    singleIslandTotalCategoryUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of THIS item can be used in MULTIPLE islands CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this item on different islands (it can be 1 on each island, 2 on island #1 and 3 on island #2 and so on).
     * it of course depends on other limitations such as `singleIslandConcurrentUsage`, `singleIslandTotalUsage`, etc.
     * 
     * ONLY USABLE FOR ITEMS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    multiIslandConcurrentUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of ANY item within this item's category/type can be used in MULTIPLE islands CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 items from the same category/type on different islands at the same time.
     * it of course depends on other limitations such as `singleIslandConcurrentCategoryUsage`, `singleIslandTotalCategoryUsage`, etc.
     * 
     * ONLY USABLE FOR ITEMS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    multiIslandConcurrentCategoryUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of THIS item can be used in MULTIPLE islands IN TOTAL.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this item on different islands (regardless of concurrent usage).
     */
    multiIslandTotalUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of ANY item within this item's category/type can be used in MULTIPLE islands IN TOTAL.
     * 
     * for example, if the limit is 5, then the user can use up to 5 items from the same category/type on different islands.
     */
    multiIslandTotalCategoryUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of THIS item can be used on a single bit CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this item on the same bit at the same time.
     * 
     * ONLY USABLE FOR ITEMS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    singleBitConcurrentUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of ANY item within this item's category/type can be used on a single bit CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 items from the same category/type on the same bit at the same time.
     * 
     * ONLY USABLE FOR ITEMS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    singleBitConcurrentCategoryUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of THIS item can be used on a single bit IN TOTAL.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this item on the same bit (regardless of concurrent usage).
     */
    singleBitTotalUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of ANY item within this item's category/type can be used on a single bit IN TOTAL.
     * 
     * for example, if the limit is 5, then the user can use up to 5 items from the same category/type on the same bit.
     */
    singleBitTotalCategoryUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of THIS item can be used on MULTIPLE bits CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this item on different bits (it can be 1 on each bit, 2 on bit #1 and 3 on bit #2 and so on).
     * it of course depends on other limitations such as `singleBitConcurrentUsage`, `singleBitTotalUsage`, etc.
     * 
     * ONLY USABLE FOR ITEMS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    multiBitConcurrentUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of ANY item within this item's category/type can be used on MULTIPLE bits CONCURRENTLY.
     * 
     * for example, if the limit is 5, then the user can use up to 5 items from the same category/type on different bits at the same time.
     * it of course depends on other limitations such as `singleBitConcurrentCategoryUsage`, `singleBitTotalCategoryUsage`, etc.
     * 
     * ONLY USABLE FOR ITEMS THAT HAVE TIME-BASED EFFECT DURATIONS.
     */
    multiBitConcurrentCategoryUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of THIS item can be used on MULTIPLE bits IN TOTAL.
     * 
     * for example, if the limit is 5, then the user can use up to 5 of this item on different bits (regardless of concurrent usage).
     */
    multiBitTotalUsage: SynthesizingItemLimitationNumerical;
    /**
     * how many of ANY item within this item's category/type can be used on MULTIPLE bits IN TOTAL.
     * 
     * for example, if the limit is 5, then the user can use up to 5 items from the same category/type on different bits.
     */
    multiBitTotalCategoryUsage: SynthesizingItemLimitationNumerical;
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
    /** 
     * the item's effect duration. 
     * 
     * if `oneTime`, the item is a one-time use item (i.e. the effect is applied once and once only).
     * if a number, the item's effect will last for that number of seconds.
     * 
     * for example, the small totem of energy can last for 1 day (86400 seconds). the isle the totem is applied to will receive a boost
     * in farming rate and decreased energy depletion rate for all placed bits for the entire day.
     */
    effectDuration: 'oneTime' | number;
    /** the increase OR decrease in resource cap of this island.
     * 
     * if `type` is `percentage`, then the `value` is a percentage increase/decrease of the current res cap. 
     * (e.g. if the item gives 5%, and the current res cap is 1000, it will be increased to 1050. similarly, if -5%, then it will be decreased to 950).
     * 
     * if type is `fixed`, then the `value` is a fixed increase of the current res cap.
     * 
     * if this item is not meant for islands and thus have no resource cap increase effect, `type` will be null and value will be set to 0.
     */
    resourceCapModifier: {
        /** if this effect is active on this item */
        active: boolean;
        /** the type of increase */
        type: 'percentage' | 'fixed' | null;
        /** the value to increase or decrease by */
        value: number;
    }
    /**
     * if the item rerolls the traits of an island.
     */
    rerollIslandTraits: {
        /** if this effect is active on this item */
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
        /** if this effect is active on this item */
        active: boolean;
        /** the value to increase or decrease by */
        value: number | null;
    }
    /**
     * increases OR decreases the earning rate of an island (%), depending on the value specified.
     */
    earningRateModifier: {
        /** if this effect is active on this item */
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
        /** if this effect is active on this item */
        active: boolean;
        /**
         * if this is `true`, any bits that are placed on the island AFTER this item is used will also obtain the effect.
         * otherwise, only bits that are placed BEFORE this item is used will obtain the effect.
         */
        allowLaterPlacedBitsToObtainEffect: boolean;
        /**
         * if this is `true`, any bits that are unplaced from the island AFTER this item is used will lose the effect.
         * otherwise, they will retain the effect until the item's effect duration is over (or permanently, depending on the item's `effectDuration`).
         */
        allowLaterUnplacedBitsToLoseEffect: boolean;
        /** the value to increase or decrease by */
        value: number | null;
    }
    /**
     * if this item allows a bit to be transferred to another Season (instead of being 'burned').
     */
    bitTransferrableBetweenSeasons: {
        /** if this effect is active on this item */
        active: boolean;
        /** the season which this bit is allowed to be transferred into (currently it will be 1) */
        value: number | null;
    }
    /**
     * if this item allows one or more of a bit's traits to be rerolled.
     */
    rerollBitTraits: {
        /** if this effect is active on this item */
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