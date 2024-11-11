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
 * Represents a collection of rewards for a collab participant.
 */
export interface CollabBasket {
    /** The unique identifier for the collab basket */
    _id: string;
    /** The name of the collab basket */
    name: string;
    /** An array of rewards included in the collab basket */
    rewards: CollabReward[];
}

/**
 * Represents a participant in a KOL or group tier.
 */
export interface CollabParticipant {
    /** The unique identifier for the participant */
    _id?: string;
    /** The name of the participant */
    name: string;
    /** The code of the participant */
    code: string;
    /** The role of the participant (Leader or Member) */
    role: 'Leader' | 'Member';
    /** The name of the tier */
    tier: string;
    /** The name of the community */
    community: string;
    /** The Twitter username of the participant */
    twitterUsername: string;
    /** The Discord ID of the participant */
    discordId: string;
    /** The collab basket assigned to the participant */
    basket: CollabBasket;
    /** Whether the participant can claim rewards */
    claimable: boolean;
    /** Whether the participant has fulfilled the requirements */
    approved: boolean;
    claimedAt: Date;
}
