import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * Island schema. Represents closely to the `Island` interface in `models/island.ts`.
 */
export const IslandSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    islandId: Number,
    type: String,
    ownerData: Object,
    blockchainData: Object,
    purchaseDate: Number,
    obtainMethod: String,
    currentLevel: Number,
    placedBitIds: Array,
    traits: Array,
    islandResourceStats: {
        baseResourceCap: Number,
        resourcesGathered: Array,
        dailyBonusResourcesGathered: Number,
        claimableResources: Array,
        gatheringStart: Number,
        gatheringEnd: Number,
        lastClaimed: Number,
        gatheringProgress: Number,
        lastUpdatedGatheringProgress: Number,
        // added versioning system to prevent race conditions 
        // when users claim resources while `dropResource` is called.
        version: {
            type: Number,
            default: 0
        }
    },
    islandStatsModifiers: Object,
    islandTappingData: Object
})