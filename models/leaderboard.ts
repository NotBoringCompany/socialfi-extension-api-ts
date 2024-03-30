/**
 * Represents a leaderboard.
 */
export interface Leaderboard {
    /** the type of leaderboard */
    type: LeaderboardType;
    /** user data for this leaderboard (points etc)  */
    userData: LeaderboardUserData[];
}

/**
 * Lists the types of leaderboards.
 */
export enum LeaderboardType {
    /** main leaderboards are standalone leaderboards */
    MAIN = 'Main',
    /** weekly leaderboards may get reset and/or get added to main leaderboards */
    WEEKLY = 'Weekly'
}

/**
 * Represents user data for a leaderboard.
 */
export interface LeaderboardUserData {
    /** the user's database ID */
    userId: string;
    /** the user's points */
    points: number;
}