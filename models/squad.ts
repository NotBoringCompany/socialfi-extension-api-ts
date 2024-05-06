/**
 * Represents a squad instance.
 */
export interface Squad {
    /** the squad name */
    name: string;
    /** the squad members */
    members: SquadMember[];
    /** when this squad was formed */
    formedTimestamp: number;
}

/**
 * 
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
 * Represents a squad role.
 */
export enum SquadRole {
    LEADER = 'LEADER',
    MEMBER = 'MEMBER'
}