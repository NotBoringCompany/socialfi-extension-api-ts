import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * WeeklyMVPClaimableReward schema. Represents closely to the `WeeklyMVPClaimableReward` interface in `models/weeklyMVPReward.ts`.
 */
export const WeeklyMVPClaimableRewardSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    userId: {
        type: String,
        index: true
    },
    username: String,
    twitterProfilePicture: String,
    claimableRewards: Array
});

/**
 * WeeklyMVPRankingLeaderboard schema. Represents closely to the `WeeklyMVPRanking` interface in `models/weeklyMVPReward.ts`.
 */
export const WeeklyMVPRankingLeaderboardSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    week: {
        type: Number,
        index: true
    },
    startTimestamp: Number,
    endTimestamp: Number,
    xCookiesSpentRankingData: [{
        userId: String,
        username: String,
        twitterProfilePicture: String,
        ranking: Number,
        amount: Number
    }],
    bitOrbsConsumedRankingData: [{
        userId: String,
        username: String,
        twitterProfilePicture: String,
        ranking: Number,
        amount: Number
    }],
    terraCapsulatorsConsumedRankingData: [{
        userId: String,
        username: String,
        twitterProfilePicture: String,
        ranking: Number,
        amount: Number
    }]
})