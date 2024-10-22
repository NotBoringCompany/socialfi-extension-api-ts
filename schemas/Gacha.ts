import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';
import { UserWonderspinData, Wonderspin } from '../models/gacha';

export const WonderspinSchema = new mongoose.Schema<Wonderspin>({
    _id: {
        type: String,
        default: generateObjectId()
    },
    name: {
        type: String,
        index: true
    },
    fortuneCrestThreshold: Number,
    fortuneSurgeThreshold: Number,
    fortuneBlessingThreshold: Number,
    fortunePeakThreshold: Number,
    assetData: [{
        assetType: String,
        asset: Object,
        imageUrl: String,
        tier: String,
        featured: Boolean,
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