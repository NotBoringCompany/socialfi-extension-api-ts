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
 * 
 * An item is a general term used for various things that can be obtained and used in the game.
 */
export enum ItemType {
    BIT_ORB = 'Bit Orb',
    TERRA_CAPSULATOR = 'Terra Capsulator',
    RESOURCE = 'Resource',
    FOOD = 'Food'
}