import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * Squad leaderboard schema. Represents closely to the `SquadLeaderboard` interface in `models/squadLeaderboard.ts`.
 */
export const SquadLeaderboardSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    week: Number,
    pointsData: [{
        squadId: String,
        memberPoints: [{
            userId: String,
            points: Number
        }]
    }]
})