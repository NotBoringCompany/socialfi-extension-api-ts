/**
 * Represents a tutorial reward instance for a tutorial.
 */
export interface TutorialReward {
    /** the type of reward */
    type: TutorialRewardType;
    /** human-readable label for the reward */
    label: string;
    /** numerical value of the reward */
    amount: number;
    /** obtained reward */
    value?: any;
}

/**
 * Represents the tutorial reward type.
 */
export enum TutorialRewardType {
    X_COOKIES = 'xCookies',
    BIT = 'Bit',
    ISLAND = 'Island'
}


/**
 * Represents a tutorial instance where users can learn about the game.
 */
export interface Tutorial {
    /** the tutorial id */
    id: number;
    /** the tutorial name */
    name: string;
    /** the rewards for this tutorial */
    rewards: TutorialReward[];
}
