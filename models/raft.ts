import { Resource } from './resource';

/****************
 * RAFT-RELATED MODELS
 ****************/

/**
 * Represents a raft.
 */
export interface Raft {
    /** unique id to distinguish the raft, starts from 1 */
    raftId: number;
    /** owner of this raft; equates to the user's object ID in the database */
    owner: string;
    /** the IDs of the bits that are placed (tied down) into this raft to gather seaweed */
    placedBitIds: number[];
    /** resource stats related to the raft, such as gathering rate */
    raftResourceStats: RaftResourceStats;
}

/**
 * Represents the gathering and resource stats of a raft.
 * 
 * NOTE: Currently, bits within rafts can only gather seaweed.
 */
export interface RaftResourceStats {
    /** total seaweed gathered, incl. ones claimed already */
    seaweedGathered: Resource[];
    /** gathered seaweed that are claimable but not claimed to the inventory yet (pending) */
    claimableSeaweed: Resource[];
    /** start timestamp of gathering; will essentially equate to when the first bit is added */
    gatheringStart: number;
    /** the last timestamp of when `claimableSeaweed` was claimed */
    lastClaimed: number;
    /** current gathering rate for seaweed in AMOUNT PER HOUR (note that this isn't like the island's gathering rate, which is in %/HOUR)
     * (excl. boosts/modifiers but incl. base gathering rate + level modifiers from bits) 
     */
    currentGatheringRate: number;
    /** gathering progress to gather 1 SEAWEED; will be from 0 to 100
     * once progress goes > 100, it will gather 1 resource and reset back to 0 + any overflow of %
     * (UPDATED PER HOUR)
     */
    gatheringProgress: number;
}
