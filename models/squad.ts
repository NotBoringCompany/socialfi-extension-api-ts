/**
 * Represents a squad instance.
 */
export interface Squad {
    /** the squad name */
    name: string;
    /** 
     * the number of times the squad name was changed 
     * 
     * this is used to determine if the squad is eligible for a free name change (only first time is free for now)
     */
    nameChangeCount: number;
    /** the timestamp when the squad name was last changed */
    lastNameChangeTimestamp: number;
    /** the squad members */
    members: SquadMember[];
    /** pending squad members who want to join the squad but not confirmed yet by the leader */
    pendingMembers: PendingSquadMember[];
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
    /** the squad's existing and current ranking data */
    squadRankingData: SquadRankingData[];
}

/**
 * Represents the squad ranking data.
 */
export interface SquadRankingData {
    /** the week number */
    week: number;
    /** the squad's rank for this week */
    rank: SquadRank;
}

/**
 * Represents the squad ranking.
 */
export enum SquadRank {
    UNRANKED = 'Unranked',
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
 * Represents a pending squad member.
 */
export interface PendingSquadMember {
    /** the database user ID of this member */
    userId: string;
    /** when this member requested to join */
    requestedTimestamp: number;
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