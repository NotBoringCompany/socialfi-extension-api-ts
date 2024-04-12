import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * StarterCode schema. Represents closely to the `StarterCodeData` interface in `models/invite.ts`.
 */
export const StarterCodeSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    code: String,
    maxUses: Number,
    usedBy: Array
});