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

/**
 * Represents the weekly MVP ranking for each week.
 */
export interface WeeklyMVPRanking {
    /** the week number */
    week: number;
    /** the start timestamp of this week */
    startTimestamp: number;
    /** the end timestamp of this week */
    endTimestamp: number;
    /** the ranking data for xCookiesSpent */
    xCookiesSpentRankingData: WeeklyMVPRankingData[];
    /** the ranking data for bitOrbsConsumed */
    bitOrbsConsumedRankingData: WeeklyMVPRankingData[];
    /** the ranking data for terraCapsulatorsConsumed */
    terraCapsulatorsConsumedRankingData: WeeklyMVPRankingData[];
}

/**
 * Represents the ranking data of a user in the latest weekly MVP ranking for a specific type (e.g. xCookies spent, bit orbs/terra caps consumed).
 */
export interface WeeklyMVPRankingData {
    /** the user's database ID */
    userId: string;
    /** the user's username */
    username: string;
    /** the user's twitter profile picture URL */
    twitterProfilePicture: string;
    /** the ranking for this ranking type */
    ranking: number;
    /** the consumed/spent amount of this particular type (e.g. for xCookies spent, then `amount` is the amount of xCookies spent) */
    amount: number;
}