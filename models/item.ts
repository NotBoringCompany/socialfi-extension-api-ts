/****************
 * ITEM-RELATED MODELS
 ****************/

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
    RAFT_SPEED_BOOSTER_1_MIN = 'Raft Speed Booster 1 Min',
    RAFT_SPEED_BOOSTER_2_MIN = 'Raft Speed Booster 2 Min',
    RAFT_SPEED_BOOSTER_3_MIN = 'Raft Speed Booster 3 Min',
    RAFT_SPEED_BOOSTER_5_MIN = 'Raft Speed Booster 5 Min',
    RAFT_SPEED_BOOSTER_10_MIN = 'Raft Speed Booster 10 Min',
    RAFT_SPEED_BOOSTER_15_MIN = 'Raft Speed Booster 15 Min',
    RAFT_SPEED_BOOSTER_30_MIN = 'Raft Speed Booster 30 Min',
    RAFT_SPEED_BOOSTER_60_MIN = 'Raft Speed Booster 60 Min',
}

/**
 * Represents all Bit Orbs in the game.
 */
export enum BitOrbItem {
    BIT_ORB_I = 'Bit Orb (I)',
    BIT_ORB_II = 'Bit Orb (II)',
    BIT_ORB_III = 'Bit Orb (III)'
}

/**
 * Represents all Terra Capsulators in the game.
 */
export enum TerraCapsulatorItem {
    TERRA_CAPSULATOR_I = 'Terra Capsulator (I)',
    TERRA_CAPSULATOR_II = 'Terra Capsulator (II)',
    TERRA_CAPSULATOR_III = 'Terra Capsulator (III)'
}

/**
 * Represents the type of item, which are generic assets that are usable in-game.
 */
export type ItemType = BoosterItem | BitOrbItem | TerraCapsulatorItem;