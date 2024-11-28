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
    usable: Boolean,
    ownerData: Object,
    blockchainData: Object,
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

/**
 * BitTraitData schema. Represents closely to the `BitTraitData` interface in `models/bit.ts`.
 */
export const BitTraitDataSchema = new mongoose.Schema<BitTraitData>({
    _id: {
        type: String,
        default: generateObjectId()
    },
    trait: String,
    effect: String,
    rarity: String,
    category: String,
    subcategory: String
})