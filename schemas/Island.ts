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
    islandId: {
        type: Number,
        index: true
    },
    type: String,
    owner: String,
    purchaseDate: Number,
    obtainMethod: String,
    currentLevel: Number,
    currentTax: Number,
    placedBitIds: Array,
    traits: Array,
    islandResourceStats: Object,
    islandEarningStats: Object,
    islandStatsModifiers: Object
})