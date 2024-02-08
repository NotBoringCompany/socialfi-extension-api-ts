/****************
 * ITEM-RELATED MODELS
 ****************/

/**
 * Represents an item.
 */
export interface Item {
    /** the type of item */
    type: ItemType;
    /** the amount of item */
    amount: number;
}

/**
 * Represents the type of item.
 */
export enum ItemType {
    SCROLL_OF_HASTE = 'Scroll of Haste',
    SCROLL_OF_RESTORATION = 'Scroll of Restoration',
}