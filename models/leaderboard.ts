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
    /** the user's profile picture URL */
    userPictureUrl: string;
    /** the user's points */
    points: number;
}