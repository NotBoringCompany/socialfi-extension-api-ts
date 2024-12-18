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

/**
 * User leaderboard data schema. Represents closely to the `UserLeaderboardData` interface in `models/leaderboard.ts`.
 */
export const UserLeaderboardDataSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    userId: String,
    username: String,
    twitterProfilePicture: String,
    season: Number,
    points: Number,
});