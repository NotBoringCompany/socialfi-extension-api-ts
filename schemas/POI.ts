import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * POI schema. Represents closely to the `POI` interface in `models/POI.ts`.
 */
export const POISchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    name: String,
    distanceTo: {
        type: Map,
        of: Number,
    },
    shop: {
        globalItems: [{
            _id: false,
            name: String,
            buyableAmount: { type: mongoose.SchemaTypes.Mixed },
            sellableAmount: { type: mongoose.SchemaTypes.Mixed },
            buyingPrice: {
                _id: false,
                xCookies: { type: mongoose.SchemaTypes.Mixed },
                cookieCrumbs: { type: mongoose.SchemaTypes.Mixed },
            },
            sellingPrice: {
                _id: false,
                leaderboardPoints: { type: mongoose.SchemaTypes.Mixed },
            },
        }],
        playerItems: [{
            _id: false,
            name: String,
            buyableAmount: { type: mongoose.SchemaTypes.Mixed },
            sellableAmount: { type: mongoose.SchemaTypes.Mixed },
            buyingPrice: {
                _id: false,
                xCookies: { type: mongoose.SchemaTypes.Mixed },
                cookieCrumbs: { type: mongoose.SchemaTypes.Mixed },
            },
            sellingPrice: {
                _id: false,
                leaderboardPoints: { type: mongoose.SchemaTypes.Mixed },
            },
            userTransactionData: {
                userId: String,
                boughtAmount: Number,
                soldAmount: Number,
            },
        }],
    },
});