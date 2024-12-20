import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';
import { UserWonderspinData, Wonderspin } from '../models/gacha';

/**
 * Wonderspin schema. Represents closely to the `Wonderspin` interface in `models/gacha.ts`.
 */
export const WonderspinSchema = new mongoose.Schema<Wonderspin>({
    _id: {
        type: String,
        default: generateObjectId()
    },
    name: {
        type: String,
        index: true
    },
    ticketType: {
        type: String,
        index: true
    },
    active: Boolean,
    fortuneCrestThreshold: Number,
    fortuneSurgeThreshold: Number,
    fortuneBlessingThreshold: Number,
    fortunePeakThreshold: Number,
    assetData: [{
        assetType: String,
        asset: Object,
        amount: Number,
        imageUrl: String,
        tier: String,
        featured: Boolean,
        probabilityWeight: Number,
        _id: false
    }]
})

export const UserWonderspinDataSchema = new mongoose.Schema<UserWonderspinData>({
    _id: {
        type: String,
        default: generateObjectId()
    },
    userId: {
        type: String,
        index: true
    },
    wonderspinId: String,
    totalRolls: Number,
    rollsUntilFortuneCrest: Number,
    rollsUntilFortuneSurge: Number,
    currentFortuneSurgeRoll: Number,
    rollsUntilFortuneBlessing: Number,
    rollsUntilFortunePeak: Number
});