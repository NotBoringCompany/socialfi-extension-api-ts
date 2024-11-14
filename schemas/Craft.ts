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
        assetExtendedData: Object,
        // assetExtendedData: {
        //     minimumRarity: String,
        //     maximumRarity: String,
        //     limitations: {
        //         applicableOnEmptyIsland: Boolean,
        //         singleIslandConcurrentUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         singleIslandConcurrentCategoryUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         singleIslandTotalUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         singleIslandTotalCategoryUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         multiIslandConcurrentUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         multiIslandConcurrentCategoryUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         multiIslandTotalUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         multiIslandTotalCategoryUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         singleBitConcurrentUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         singleBitConcurrentCategoryUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         singleBitTotalUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         singleBitTotalCategoryUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         multiBitConcurrentUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         multiBitConcurrentCategoryUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         multiBitTotalUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //         multiBitTotalCategoryUsage: {
        //             active: Boolean,
        //             limit: Number
        //         },
        //     },
        //     effectValues: {
        //         affectedAsset: String,
        //         effectDuration: mongoose.Schema.Types.Mixed,
        //         resourceCapModifier: {
        //             active: Boolean,
        //             type: String,
        //             value: Number
        //         },
        //         rerollIslandTraits: {
        //             active: Boolean,
        //             type: String,
        //             allowDuplicates: Boolean,
        //             value: mongoose.Schema.Types.Mixed,
        //         },
        //         gatheringRateModifier: {
        //             active: Boolean,
        //             value: Number
        //         },
        //         placedBitsEnergyDepletionRateModifier: {
        //             active: Boolean,
        //             allowLaterPlacedBitsToObtainEffect: Boolean,
        //             allowLaterPlacedBitsToLoseEffect: Boolean,
        //             value: Number
        //         },
        //         bitTransferrableBetweenSeasons: {
        //             active: Boolean,
        //             value: Number
        //         },
        //         rerollBitTraits: {
        //             active: Boolean,
        //             type: String,
        //             result: String,
        //             allowDuplicates: Boolean,
        //             value: mongoose.Schema.Types.Mixed,
        //         }
        //     }
        // }
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