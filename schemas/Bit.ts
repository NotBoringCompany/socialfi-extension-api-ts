import mongoose from 'mongoose';

/**
 * Bit schema. Represents closely to the `Bit` interface in `models/bit.ts`.
 */
export const BitSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    bitId: Number,
    rarity: String,
    gender: String,
    premium: Boolean,
    owner: String,
    purchaseDate: Number,
    obtainMethod: String,
    placedIslandId: Number,
    lastRelocationTimestamp: Number,
    currentFarmingLevel: Number,
    farmingStats: Object,
    bitStatsModifiers: Object,
})