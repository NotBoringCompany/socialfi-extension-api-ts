/**
 * Represents a weekly leaderboard for squads.
 */
export interface SquadWeeklyLeaderboard {
    /** the week number */
    week: number;
    /** the squad points data */
    pointsData: SquadWeeklyPointsData[];
}

/**
 * Represents the squad points earned by members over a week.
 */
export interface SquadWeeklyPointsData {
    /** the squad id */
    squadId: string;
    /** the squad name */
    squadName: string;
    /** points data for each member */
    memberPoints: SquadMemberWeeklyPoints[];
}

/**
 * Represents the squad points earned by a member over a week.
 */
export interface SquadMemberWeeklyPoints {
    /** the members's database ID */
    userId: string;
    /** the member's username */
    username: string;
    /** the member's points */
    points: number;
}

