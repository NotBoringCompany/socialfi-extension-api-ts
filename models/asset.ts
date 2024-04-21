import { FoodType } from './food';
import { ItemType } from './item';
import { ResourceType } from './resource';

/**
 * Represents the list of assets available in our game.
 */
export interface Asset {
    type: AssetType;
    description: string;
}

/**
 * AssetType represents the different types of assets in the game.
 * 
 * This includes resources, food, items, and other assets (essentially every single 'thing' in the game).
 */
export type AssetType = 
    ResourceType | FoodType | ItemType;