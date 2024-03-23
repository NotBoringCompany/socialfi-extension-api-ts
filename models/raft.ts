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
    /** the stats of the raft */
    stats: RaftStats;
}

/**
 * Represents the stats of a raft.
 */
export interface RaftStats {
    /** the speed of the raft */
    speed: number;
    /** how many bits the raft can hold */
    capacity: number;
}
