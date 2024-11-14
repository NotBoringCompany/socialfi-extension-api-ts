import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';
import { CraftingRecipe, CraftingRecipeLine } from '../models/craft';

export const CraftingRecipeSchema = new mongoose.Schema<CraftingRecipe>({
    _id: {
        type: String,
        default: generateObjectId()
    },
    craftedAssetData: {
        asset: String,
        assetType: String,
        assetDescription: String,
        assetRarity: String,
        assetEffectDuration: mongoose.Schema.Types.Mixed,
    },
    craftingRecipeLine: String,
    craftingDuration: Number,
    baseEnergyRequired: Number,
    baseSuccessChance: Number,
    baseCritChance: Number,
    obtainedPoints: Number,
    requiredXCookies: Number,
    requiredLevel: mongoose.Schema.Types.Mixed,
    requiredCraftingLevel: mongoose.Schema.Types.Mixed,
    earnedXP: Number,
    weight: Number,
    requiredAssetGroups: [{
        requiredAssets: [{
            assetCategory: String,
            specificAsset: String,
            requiredRarity: String,
            amount: Number,
            _id: false
        }],
        _id: false,
    }]
})

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
    claimData: {
        claimableAmount: Number,
        claimedAmount: Number,
    },
    craftingStart: Number,
    craftingEnd: Number
})