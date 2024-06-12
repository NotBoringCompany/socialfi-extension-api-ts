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
        squadName: String,
        memberPoints: [{
            userId: String,
            username: String,
            points: Number
        }]
    }]
});

/**
 * Squad member claimable weekly reward schema. Represents closely to the `SquadMemberClaimableWeeklyReward` interface in `models/squadLeaderboard.ts`.
 */
export const SquadMemberClaimableWeeklyRewardSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    userId: String,
    username: String,
    twitterProfilePicture: String,
    claimableRewards: [{
        type: String,
        amount: Number
    }]
})