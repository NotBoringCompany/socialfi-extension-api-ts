import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';
import { BitTraitData } from '../models/bit';

/**
 * Bit schema. Represents closely to the `Bit` interface in `models/bit.ts`.
 */
export const BitSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    bitId: Number,
    bitNameData: Object,
    bitType: String,
    rarity: String,
    gender: String,
    premium: Boolean,
    owner: String,
    purchaseDate: Number,
    obtainMethod: String,
    placedIslandId: Number,
    lastRelocationTimestamp: Number,
    currentFarmingLevel: Number,
    traits: Array,
    equippedCosmetics: Object,
    farmingStats: Object,
    bitStatsModifiers: Object,
})