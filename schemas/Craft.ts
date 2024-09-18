import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';
import { CraftingRecipeLine } from '../models/craft';

/**
 * OngoingCraft schema. Represents closely to the `OngoingSchema` interface in `models/craft.ts`.
 */
export const OngoingCraftSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    userId: String,
    status: String,
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
            amount: Number
        }],
        chosenFlexibleRequiredAssets: [{
            assetCategory: String,
            specificAsset: String,
            requiredRarity: String,
            amount: Number
        }]
    },
    craftingStart: Number,
    craftingEnd: Number
})