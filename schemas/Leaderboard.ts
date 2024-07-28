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
    name: {
        type: String,
        index: true
    },
    startTimestamp: Number,
    userData: [{
        _id: false,
        userId: String,
        username: String,
        twitterProfilePicture: String,
        pointsData: [{
            _id: false,
            points: Number,
            source: String
        }]
    }]
});