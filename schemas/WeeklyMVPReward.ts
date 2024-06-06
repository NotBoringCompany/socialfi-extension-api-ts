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