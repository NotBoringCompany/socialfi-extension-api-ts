/**
 * Represents the claimable weekly rewards for any eligible user for Weekly MVP benefits.
 */
export interface WeeklyMVPClaimableReward {
    /** the user's database ID */
    userId: string;
    /** the user's username */
    username: string;
    /** the user's twitter profile picture URL */
    twitterProfilePicture: string;
    /** the claimable weekly rewards the user can claim */
    claimableRewards: WeeklyMVPReward[];
}

export interface WeeklyMVPReward {
    /** the reward type */
    type: WeeklyMVPRewardType;
    /** the amount of the reward to give */
    amount: number;
}

/**
 * Represents all available Weekly MVP reward types.
 */
export enum WeeklyMVPRewardType {
    LEADERBOARD_POINTS = 'Leaderboard Points'
}