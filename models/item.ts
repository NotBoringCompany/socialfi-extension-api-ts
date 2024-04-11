/****************
 * ITEM-RELATED MODELS
 ****************/

import { FoodType } from './food';
import { ResourceType } from './resource';

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
 * Lists all possible boosters in the game.
 */
export enum BoosterItem {
    GATHERING_PROGRESS_BOOSTER_25 = 'Gathering Progress Booster 25%',
    GATHERING_PROGRESS_BOOSTER_50 = 'Gathering Progress Booster 50%',
    GATHERING_PROGRESS_BOOSTER_100 = 'Gathering Progress Booster 100%',
    GATHERING_PROGRESS_BOOSTER_200 = 'Gathering Progress Booster 200%',
    GATHERING_PROGRESS_BOOSTER_300 = 'Gathering Progress Booster 300%',
    GATHERING_PROGRESS_BOOSTER_500 = 'Gathering Progress Booster 500%',
    GATHERING_PROGRESS_BOOSTER_1000 = 'Gathering Progress Booster 1000%',
    RAFT_SPEED_BOOSTER_10 = 'Raft Speed Booster 10%',
    RAFT_SPEED_BOOSTER_25 = 'Raft Speed Booster 25%',
    RAFT_SPEED_BOOSTER_50 = 'Raft Speed Booster 50%',
    RAFT_SPEED_BOOSTER_100 = 'Raft Speed Booster 100%',
}

/**
 * Represents the type of item.
 * 
 * An item is a general term used for various things that can be obtained and used in the game.
 * 
 * This however doesn't include resources, food, bit orbs, terra caps and others, which have their own interfaces/types.
 */
export type ItemType = BoosterItem;
// export type ItemType = 
//     ResourceType | 'Terra Capsulator' | 'Bit Orb' | FoodType | BoosterItem;