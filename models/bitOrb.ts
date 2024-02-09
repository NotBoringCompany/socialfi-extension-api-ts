/****************
 * BIT ORB-RELATED MODELS
 ****************/

import { ObtainMethod } from './obtainMethod';

/**
 * Represents a Bit Orb.
 */
export interface BitOrb {
    /** unique id to distinguish the bit orb, starts from 1 */
    bitOrbId: number;
    /** owner of this bit orb; equates to the user's object ID in the database */
    owner: string;
    /** obtain method of the bit orb */
    obtainMethod: ObtainMethod;
    /** purchase date of this bit orb (currently limited to when it was obtained from our shop) */
    purchaseDate: number;
    /** data of the bit orb when it is opened; will default to default values if not yet opened */
    openedData: OpenedBitOrbData;
}

/**
 * Represents the data of the bit orb when it is opened.
 */
export interface OpenedBitOrbData {
    /** if the bit orb is opened */
    opened: boolean;
    /** the timestamp of when the bit orb was opened; 0 if not opened yet */
    openedTimestamp: number;
    /** the ID of the bit obtained from this bit orb if already opened */
    obtainedBitId: number;
}