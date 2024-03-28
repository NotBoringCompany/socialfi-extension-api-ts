import mongoose from 'mongoose';

/**
 * Raft schema. Represents closely to the `Raft` interface in `models/raft.ts`.
 */
export const RaftSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    raftId: Number,
    owner: String,
    currentLevel: Number,
    placedBitIds: Array,
    stats: Object
})