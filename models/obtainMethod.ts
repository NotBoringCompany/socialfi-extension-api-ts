import { BitOrbType } from './item';

/**
 * Represents the method to obtain an asset.
 */
export enum ObtainMethod {
    MARKETPLACE = 'Marketplace',
    TERRA_CAPSULATOR = 'Terra Capsulator',
    BIT_ORB_I = BitOrbType.BIT_ORB_I,
    BIT_ORB_II = BitOrbType.BIT_ORB_II,
    BIT_ORB_III = BitOrbType.BIT_ORB_III,
    /** staking benefits obtained from Blast or other staking protocols */
    STAKING = 'Staking',
    /* reward obtained from signing up */
    SIGN_UP = 'Sign Up',
    /* reward obtained from an event */
    EVENT = 'Event',
    /* a message in a bottle, currently used to obtain a barren island */
    BOTTLED_MESSAGE = 'Bottled Message',
    /* reward obtained from completing tutorial */
    TUTORIAL = 'Tutorial',
    /* reward obtained from completing quest */
    QUEST = 'Quest',
    /** obtained from xterio related quests/signup */
    XTERIO = 'Xterio',
}