/****************
 * COLLAB-RELATED MODELS
 ****************/

/**
 * Represents the type of reward given to a KOL or group member.
 */
export enum CollabRewardType {
    X_BIT_BERRY = 'xBitBerry',
    BIT_ORB_I = 'Bit Orb (I)',
    BIT_ORB_II = 'Bit Orb (II)',
    BIT_ORB_III = 'Bit Orb (III)',
    TERRA_CAPSULATOR_I = 'Terra Capsulator (I)',
    TERRA_CAPSULATOR_II = 'Terra Capsulator (II)',
}

/**
 * Represents a reward given to a KOL or group member.
 */
export interface CollabReward {
    /** The type of the reward */
    type: CollabRewardType;
    /** The amount of the reward */
    amount: number;
}

/**
 * Represents a participant in a KOL or group tier.
 */
export interface Participant {
    /** The unique identifier for the participant */
    _id?: string;
    /** The name of the participant */
    name: string;
    /** The code of the participant */
    code: string;
    /** The role of the participant (leader or member) */
    role: 'leader' | 'member';
    /** The Twitter username of the participant */
    twitterUsername: string;
    /** The Discord ID of the participant */
    discordId: string;
    /** Whether the participant can claim rewards */
    claimable: boolean;
    /** Whether the participant has fulfilled the requirements */
    approved: boolean;
}

/**
 * Represents a group in a group tier.
 */
export interface Group {
    /** The name of the group */
    name: string;
    /** The code of the group */
    code: string;
    /** The participants in the group */
    participants: Participant[];
}

/**
 * Represents a KOL reward tier.
 */
export interface KOLCollab {
    /** The unique identifier for the KOL reward tier */
    _id: string;
    /** The name of the tier */
    tier: string;
    /** The maximum number of users for this tier */
    maxUsers: number;
    /** The rewards associated with this tier */
    rewards: CollabReward[];
    /** The participants in this tier */
    participants: Participant[];
}

/**
 * Represents a group reward tier.
 */
export interface GroupCollab {
    /** The unique identifier for the group reward tier */
    _id: string;
    /** The name of the tier */
    tier: string;
    /** The maximum number of groups for this tier, null if unlimited */
    maxGroups: number | null;
    /** The maximum number of members in each group for this tier, null if unlimited */
    maxMembers: number | null;
    /** The rewards for leaders in this tier */
    leaderRewards: CollabReward[] | null;
    /** The rewards for members in this tier */
    memberRewards: CollabReward[] | null;
    /** The groups in this tier */
    groups: Group[];
}

/**
 * Represents a collab tier.
 */
export interface Collab {
    _id: string;
    /** The name of the tier */
    tier: string;
    /** The type of the collab */
    type: 'kol' | 'group';
    /** The rewards for leaders in this tier, this is also used for KOL rewards */
    leaderRewards: CollabReward[] | null;
    /** The rewards for members in this tier */
    memberRewards: CollabReward[] | null;
    /** The participants of KOL collab */
    participants?: Participant[];
    /** The groups of group collab */
    groups?: Group[];
}
