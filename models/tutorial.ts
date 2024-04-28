/**
 * Represents tutorial reward type.
 */
export enum TutorialRewardType {
    X_COOKIES = 'xCookies',
    BIT = 'Bit',
}

/**
 * Represents tutorial reward structure in a tutorial.
 */
export interface TutorialReward {
    /** type of the reward */
    type: TutorialRewardType;
    /** human-readable label for the reward */
    label: string;
    /** numerical value of the reward */
    amount: number;
    /** obtained reward */
    value?: any;
}

/**
 * Represents a tutorial instance where users can learn about the game.
 */
export interface Tutorial {
    /** the tutorial id */
    id: number;
    /** the tutorial name */
    name: string;
}
