import mongoose from 'mongoose';

/**
 * Island schema. Represents closely to the `Island` interface in `models/island.ts`.
 */
export const IslandSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: new mongoose.Types.ObjectId()
    },
    islandId: Number,
    type: String,
    owner: String,
    purchaseDate: Number,
    obtainMethod: String,
    currentLevel: Number,
    currentTax: Number,
    placedBitIds: Array,
    islandResourceStats: Object,
    islandEarningStats: Object,
    islandStatsModifiers: Object
})