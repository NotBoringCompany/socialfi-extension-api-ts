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
    userId: String,
    username: String,
    twitterProfilePicture: String,
    claimableRewards: Array
});

export const WeeklyMVPRankingDataSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    week: Number,
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