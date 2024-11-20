import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * Tutorial schema. Represents closely to the `Tutorial` interface in `models/tutorial.ts`.
 */
export const TutorialSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    id: Number,
    name: String,
    rewards: Array,
    autoAccept: Boolean
});