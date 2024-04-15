
// import { ObtainMethod } from './obtainMethod';

// /****************
//  * BIT ORB-RELATED MODELS
//  ****************/
/**
 * Represents all Bit Orbs in the game.
 */
export enum BitOrbItem {
    BIT_ORB_I = 'Bit Orb (I)',
    BIT_ORB_II = 'Bit Orb (II)',
    BIT_ORB_III = 'Bit Orb (III)'
}

/**
 * Represents the interface for a user's bit orbs owned.
 */
export interface UserBitOrb {
    /** the type of bit orb */
    type: BitOrbItem;
    /** the amount of this particular bit orb type owned */
    amount: number;
}