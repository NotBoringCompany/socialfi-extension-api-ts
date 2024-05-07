/**
 * Represents a squad instance.
 */
export interface Squad {
    /** the squad name */
    name: string;
    /** the squad members */
    members: SquadMember[];
    /** the max amount of members allowed for this squad */
    maxMembers: number;
    /** when this squad was formed */
    formedTimestamp: number;
    /** the user's database id who formed this squad */
    formedBy: string;
    /** the method used to create this squad */
    creationMethod: SquadCreationMethod;
    /** the squad points data (data regarding points obtained by members across each week) */
    squadPointsData: SquadPointsData;
    /** the current ranking of the squad based on the previous week's performance (points) */
    currentRanking: SquadRank;
}

/**
 * Represents the squad points data.
 */
export interface SquadPointsData {
    /** the total squad points accumulated for this squad */
    totalSquadPoints: number;
    /** the total squad points earned on previous weeks */
    previousWeeks: SquadPointsWeekly[];
    /** the total squad points earned on this week */
    currentWeek: SquadPointsWeekly;
}

/**
 * Represents the squad points earned by a member on a week.
 */
export interface SquadPointsWeekly {
    /** the week number */
    week: number;
    /** the squad points earned by each member */
    memberPoints: SquadMemberWeeklyPoints[];
}

/**
 * Represents the squad points earned by a member on a week.
 */
export interface SquadMemberWeeklyPoints {
    /** the database user ID of this member */
    userId: string;
    /** the squad points earned by this member */
    points: number;
}

/**
 * Represents the squad ranking.
 */
export enum SquadRank {
    BRONZE = 'Bronze',
    SILVER = 'Silver',
    GOLD = 'Gold',
    PLATINUM = 'Platinum',
    DIAMOND = 'Diamond',
    MASTER = 'Master',
} 

/**
 * Represents a squad member.
 */
export interface SquadMember {
    /** the database user ID of this member */
    userId: string;
    /** the role of the member within this squad */
    role: SquadRole;
    /** when this member joined */
    joinedTimestamp: number;
    /** when this member's role was last updated */
    roleUpdatedTimestamp: number;
}

/**
 * Represents the method used to create a squad.
 */
export enum SquadCreationMethod {
    // paid xCookies
    X_COOKIES = 'xCookies',
    // used their starter code to create the squad for free
    FREE_STARTER_CODE = 'Free Starter Code',
}

/**
 * Represents a squad role.
 */
export enum SquadRole {
    LEADER = 'Leader',
    MEMBER = 'Member'
}