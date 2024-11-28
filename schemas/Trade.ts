import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';
import { TradeCurrency, TradeListing, TradeStatus } from '../models/trade';

/**
 * Represents the schema for trade listings.
 */
export const TradeListingSchema = new mongoose.Schema<TradeListing & mongoose.Document>({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    user: { type: String, ref: 'Users', required: true, index: true },
    purchasedBy: [
        {
            user: { type: String, ref: 'Users', required: true },
            amount: { type: Number, required: true, min: 0 },
            purchasedTimestamp: { type: Number, required: true },
            claimed: { type: Boolean, default: false },
        },
    ],
    item: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        enum: Object.values(TradeCurrency),
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(TradeStatus),
        required: true,
        default: TradeStatus.ACTIVE,
    },
    listedTimestamp: {
        type: Number,
        required: true,
    },
});
