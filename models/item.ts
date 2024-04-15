/****************
 * ITEM-RELATED MODELS
 ****************/
import { BitOrbType } from './bitOrb';
import { BoosterItem } from './booster';
import { TerraCapsulatorType } from './terraCapsulator';

/**
 * Represents an item.
 */
export interface Item {
    /** the type of item */
    type: ItemType;
    /** the item's description */
    description: string;
    /** the amount of item (used only for methods that require amount, such as for rewards) */
    amount?: number;
}

/**
 * Represents the type of item, which are generic assets that are usable in-game.
 */
export type ItemType = BoosterItem | BitOrbType | TerraCapsulatorType;