import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * KOSClaimableDailyRewards schema. Represents closely to the `KOSClaimableDailyRewards` interface in `models/kos.ts`.
 */
export const KOSClaimableDailyRewardsSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    userId: String,
    username: String,
    twitterProfilePicture: String,
    claimableRewards: Array
});

/**
 * KOSClaimableWeeklyRewards schema. Represents closely to the `KOSClaimableWeeklyRewards` interface in `models/kos.ts`.
 */
export const KOSClaimableWeeklyRewardsSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    userId: String,
    username: String,
    twitterProfilePicture: String,
    claimableRewards: Array
});