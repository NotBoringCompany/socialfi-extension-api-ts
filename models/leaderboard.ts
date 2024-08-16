/**
 * Represents a leaderboard.
 */
export interface Leaderboard {
    // /** the type of leaderboard */
    // type: LeaderboardType;
    /** the leaderboard name */
    name: string;
    /** the start timestamp of this leaderboard (i.e. when it was started) */
    startTimestamp: number;
    /** user data for this leaderboard (points etc)  */
    userData: LeaderboardUserData[];
}

/**
 * Represents user data for a leaderboard.
 */
export interface LeaderboardUserData {
    /** the user's database ID */
    userId: string;
    /** the user's username */
    username: string;
    /** the user's twitter profile picture URL */
    twitterProfilePicture: string;
    /** the user's points data */
    pointsData: LeaderboardPointsData[];
}

/**
 * Represents points data for a leaderboard user for a specific source.
 */
export interface LeaderboardPointsData {
    /** the user's points */
    points: number;
    /** the source of this particular points data */
    source: LeaderboardPointsSource;
}

/**
 * Represents the source of points data for a leaderboard user.
 */
export enum LeaderboardPointsSource {
    RESOURCE_SELLING = 'Resource Selling',
    REFERRAL_REWARDS = 'Referral Rewards',
    INDIRECT_REFERRAL_REWARDS = 'Indirect Referral Rewards',
    DAILY_LOGIN_REWARDS = 'Daily Login Rewards',
    BEGINNER_REWARDS = 'Beginner Rewards',
    CHEST_REWARDS = 'Chest Rewards',
    COLLAB_REWARDS = 'Collab Rewards',
    LEVELLING_UP = 'Levelling Up',
    ISLAND_TAPPING = 'Island Tapping',
    KOS_BENEFITS = 'KOS Benefits',
    DISCORD_ENGAGEMENT = 'Discord Engagement',
    WEEKLY_MVP_REWARDS = 'Weekly MVP Rewards',
    BUG_BOUNTY = 'Bug Bounty',
}