import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * Squad schema. Represents closely to the `Squad` interface in `models/squad.ts`.
 */
export const SquadSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    name: String,
    nameChangeCount: Number,
    lastNameChangeTimestamp: Number,
    members: [{
        userId: String,
        username: String,
        role: String,
        joinedTimestamp: Number,
        roleUpdatedTimestamp: Number
    }],
    pendingMembers: [{
        userId: String,
        username: String,
        requestedTimestamp: Number
    }],
    maxMembers: Number,
    formedTimestamp: Number,
    formedBy: String,
    creationMethod: String,
    totalSquadPoints: Number,
    squadRankingData: [{
        week: Number,
        rank: String
    }]
})