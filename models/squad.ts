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
    /** the total number of points accumulated by this squad since creation */
    totalSquadPoints: number;
    /** the current ranking of the squad based on the previous week's performance (points) */
    currentRanking: SquadRank;
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