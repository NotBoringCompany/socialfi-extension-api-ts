import mongoose from 'mongoose';

/**
 * Raft schema. Represents closely to the `Raft` interface in `models/raft.ts`.
 */
export const RaftSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: new mongoose.Types.ObjectId()
    },
    raftId: Number,
    owner: String,
    placedBitIds: Array,
    raftResourceStats: Object,
})