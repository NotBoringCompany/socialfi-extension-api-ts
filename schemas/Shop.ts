import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * ShopAsset schema. Represents closely to the `ShopAsset` interface in `models/shop.ts`.
 */
export const ShopAssetSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    assetType: {
        type: String,
        index: true
    },
    price: {
        xCookies: Number,
        usd: Number
    },
    expirationDate: {
        type: Number,
        default: 'never'
    },
    stockData: {
        totalStock: Number,
        currentStock: Number
    },
    purchaseLimit: {
        type: Number,
        default: 'unlimited'
    },
    effectDuration: String,
    refreshIntervalData: {
        intervalType: String,
        lastRefreshed: Number
    },
    levelRequirement: {
        type: Number,
        default: 'none'
    },
    givenContent: {
        contentType: String,
        content: String,
        amount: Number
    }
});