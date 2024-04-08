/****************
 * ITEM-RELATED MODELS
 ****************/

import { FoodType } from './food';
import { BarrenResource, ResourceType } from './resource';

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
 * Represents the type of item.
 * 
 * An item is a general term used for various things that can be obtained and used in the game.
 */
export type ItemType = 
    ResourceType | 'Terra Capsulator' | 'Bit Orb' | FoodType;
// export enum ItemType {
//     BIT_ORB = 'Bit Orb',
//     TERRA_CAPSULATOR = 'Terra Capsulator',
//     RESOURCE = 'Resource',
//     FOOD = 'Food'
// }