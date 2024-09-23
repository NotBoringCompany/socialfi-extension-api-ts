import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';
import { CraftingRecipeLine } from '../models/craft';

/**
 * CraftingQueue schema. Represents closely to the `CraftingQueue` interface in `models/craft.ts`.
 */
export const CraftingQueueSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    userId: String,
    status: String,
    craftingRecipeLine: String,
    craftedAssetData: {
        asset: String,
        amount: Number,
        assetType: String,
        totalWeight: Number,
    },
    assetsUsed: {
        requiredAssets: [{
            assetCategory: String,
            specificAsset: String,
            requiredRarity: String,
            amount: Number,
            _id: false
        }],
        chosenFlexibleRequiredAssets: [{
            assetCategory: String,
            specificAsset: String,
            amount: Number,
            _id: false
        }],
        _id: false
    },
    craftingStart: Number,
    craftingEnd: Number
})