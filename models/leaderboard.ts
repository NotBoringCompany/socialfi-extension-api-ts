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
    /** the user's twitter profile picture URL */
    twitterProfilePicture: string;
    /** the user's points */
    points: number;
    /** 
     * the user's additional points 
     * 
     * the main difference between this and `points` is that `additionalPoints` 
     * don't get counted into the user's player level and other calculations where necessary.
     * however, it still does get added to the user's total points on the leaderboard later on.
     */
    additionalPoints: number;
}