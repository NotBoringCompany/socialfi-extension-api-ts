import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

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
    stats: Object
})