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
    assetName: {
        type: String,
        index: true
    },
    assetType: {
        type: String,
        enum: ['item', 'food', 'package'],
        index: true
    },
    price: {
        xCookies: Number,
        usd: Number
    },
    expirationDate: {
        type: mongoose.Schema.Types.Mixed,
        default: 'never'
    },
    stockData: {
        totalStock: {
            type: mongoose.Schema.Types.Mixed,
            default: 'unlimited',
        },
        currentStock: {
            type: mongoose.Schema.Types.Mixed,
            default: 'unlimited'
        }
    },
    purchaseLimit: {
        type: mongoose.Schema.Types.Mixed,
        default: 'unlimited'
    },
    effectDuration: {
        type: String,
        enum: ['One Time', 'Daily', 'Weekly', 'Monthly', 'Monthly Pass']
    },
    refreshIntervalData: {
        intervalType: String,
        lastRefreshed: Number
    },
    levelRequirement: {
        type: mongoose.Schema.Types.Mixed,
        default: 'none'
    },
    givenContent: {
        contentType: {
            type: String,
            enum: ['item', 'food', 'xCookies', 'monthlyPass']
        },
        content: String,
        amount: Number
    }
});

/**
 * ShopAssetPurchase schema. Represents closely to the `ShopAssetPurchase` interface in `models/shop.ts`.
 */
export const ShopAssetPurchaseSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    userId: {
        type: String,
        index: true
    },
    assetId: {
        type: String,
        index: true
    },
    assetName: String,
    amount: Number,
    totalCost: {
        cost: Number,
        currency: {
            type: String,
            enum: ['xCookies', 'usd']
        },
        paidInCurrency: String
    },
    purchaseTimestamp: Number,
    effectExpiration: {
        type: mongoose.Schema.Types.Mixed,
        default: 'never'
    },
    givenContent: {
        contentType: String,
        content: String,
        amount: Number
    }
})