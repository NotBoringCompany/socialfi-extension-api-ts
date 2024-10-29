import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * GivenContent schema for `ShopAssetSchema.givenContent`. Represents the `ShopAssetGivenContent` interface in `models/shop.ts`.
 */
const GivenContentSchema = new mongoose.Schema({
    contentType: {
        type: String,
        enum: ['item', 'food', 'igc', 'wonderpass']
    },
    content: String,
    amount: Number
}, {
    _id: false
});

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
    imageUrl: String,
    price: {
        xCookies: Number,
        finalXCookies: Number,
        usd: Number,
        finalUsd: Number
    },
    assetClassification: {
        type: String,
        enum: ['nonIAP', 'specialIAP', 'normalIAP']
    },
    availablePaymentMethods: Array,
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
        durationType: String,
        value: Number
    },
    refreshIntervalData: {
        intervalType: String,
        lastRefreshed: Number
    },
    levelRequirement: {
        type: mongoose.Schema.Types.Mixed,
        default: 'none'
    },
    givenContents: [GivenContentSchema]
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
        baseCost: Number,
        baseCurrency: {
            type: String,
            enum: ['xCookies', 'usd']
        },
        actualCost: Number,
        actualCurrency: String
    },
    blockchainData: {
        address: String,
        chain: mongoose.Schema.Types.Mixed,
        txHash: String,
        txPayload: {
            asset: String,
            amt: Number,
            cost: Number,
            curr: String
        },
        confirmationAttempts: Array,
    },
    purchaseTimestamp: Number,
    effectExpiration: {
        type: mongoose.Schema.Types.Mixed,
        default: 'never'
    },
    givenContents: [GivenContentSchema]
})