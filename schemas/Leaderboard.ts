import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * Leaderboard schema. Represents closely to the `Leaderboard` interface in `models/leaderboard.ts`.
 */
export const LeaderboardSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    name: String,
    startTimestamp: Number,
    userData: [{
        userId: String,
        points: Number
    }]
});