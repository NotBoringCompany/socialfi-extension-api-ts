import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * POAP schema. Represents closely to the `POAP` interface in `models/poap.ts`.
 */
export const POAPSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    name: String,
    description: String,
    codes: [
        {
            _id: false,
            keyword: {
                type: String,
                index: true
            },
            expirationTimestamp: Number,
            limit: Number,
        },
    ],
    attendances: [
        {
            _id: false,
            twitterId: String,
            keyword: String,
            attendanceTimestamp: Number,
        },
    ],
    startTimestamp: Number,
    endTimestamp: Number,
    createTimestamp: Number,
});
