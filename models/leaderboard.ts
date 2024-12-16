/**
 * Represents a user's leaderboard data for a season.
 */
export interface UserLeaderboardData {
    /** the user's database ID */
    userId: string;
    /** the user's Twitter username */
    username: string;
    /** the user's Twitter profile picture */
    twitterProfilePicture: string;
    /** the season this leaderboard data corresponds to */
    season: number;
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
    CRAFTING_RECIPES = 'Crafting Recipes',
}