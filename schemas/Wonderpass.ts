import mongoose from 'mongoose';
import { Wonderpass } from '../models/wonderpass';
import { generateObjectId } from '../utils/crypto';

/**
 * Wonderpass schema. Represents closely to the `Wonderpass` interface in `models/wonderpass.ts`.
 */
export const WonderpassSchema = new mongoose.Schema<Wonderpass>({
    _id: {
        type: String,
        default: generateObjectId()
    },
    name: {
        type: String,
        index: true
    },
    start: Number,
    end: Number,
    levelData: [{
        level: Number,
        xpRequired: Number,
        freeRewards: [{
            rewardType: String,
            amount: Number,
            _id: false
        }],
        premiumRewards: [{
            rewardType: String,
            amount: Number,
            _id: false
        }],
        _id: false
    }]
});

/**
 * User wonderpass data schema. Represents closely to the `UserWonderpassData` interface in `models/wonderpass.ts`.
 */
export const UserWonderpassDataSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    userId: {
        type: String,
        index: true
    },
    wonderpassId: String,
    level: Number,
    xp: Number,
    claimableFreeLevels: [Number],
    claimedFreeLevels: [Number],
    claimablePremiumLevels: [Number],
    claimedPremiumLevels: [Number]
});