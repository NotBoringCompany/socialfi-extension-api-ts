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
    /** the user's points collected throughout this season */
    points: number;
}