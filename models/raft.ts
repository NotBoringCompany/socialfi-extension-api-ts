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
    /** current level of the raft */
    currentLevel: number;
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
    seaweedGathered: number;
    /** gathered seaweed that are claimable but not claimed to the inventory yet (pending) */
    claimableSeaweed: number;
    /** start timestamp of gathering; will essentially equate to when the first bit is added */
    gatheringStart: number;
    /** the last timestamp of when `claimableSeaweed` was claimed */
    lastClaimed: number;
}
