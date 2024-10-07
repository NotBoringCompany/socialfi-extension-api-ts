import mongoose from 'mongoose';
import { ConsumedSynthesizingItem } from '../models/item';
import { generateObjectId } from '../utils/crypto';

/**
 * ConsumedSynthesizingItem schema. Represents the `ConsumedSynthesizingItem` interface in `models/item.ts`.
 */
export const ConsumedSynthesizingItemSchema = new mongoose.Schema<ConsumedSynthesizingItem>({
    _id: {
        required: true,
        default: generateObjectId()
    },
    usedBy: String,
    item: String,
    affectedAsset: {
        type: String,
        enum: ['bit', 'island']
    },
    islandOrBitId: Number,
    consumedTimestamp: Number,
    effectUntil: Number
});