import mongoose from 'mongoose';

/**
 * Bit schema. Represents closely to the `Bit` interface in `models/bit.ts`.
 */
export const BitSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: new mongoose.Types.ObjectId()
    },
    bitId: Number,
    rarity: String,
    gender: String,
    owner: String,
    purchaseDate: Number,
    obtainMethod: String,
    totalXCookiesSpent: Number,
    placedIslandId: Number,
    currentFarmingLevel: Number,
    farmingStats: Object,
    bitStatsModifiers: Object
})