import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * City schema. Represents closely to the `City` interface in `models/city.ts`.
 */
export const CitySchema = new mongoose.Schema({
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
            name: String,
            buyableAmount: Number,
            sellableAmount: Number,
            buyingPrice: [{
                xCookies: { type: mongoose.SchemaTypes.Mixed },
                cookieCrumbs: { type: mongoose.SchemaTypes.Mixed },
            }],
            sellingPrice: [{
                leaderboardPoints: { type: mongoose.SchemaTypes.Mixed },
            }],
        }],
        playerItems: [{
            name: String,
            buyingPrice: [{
                xCookies: { type: mongoose.SchemaTypes.Mixed },
                cookieCrumbs: { type: mongoose.SchemaTypes.Mixed },
            }],
            sellingPrice: [{
                leaderboardPoints: { type: mongoose.SchemaTypes.Mixed },
            }],
            userTransactionData: [{
                userId: String,
                boughtAmount: Number,
                soldAmount: Number,
                buyingLimit: Number,
                sellingLimit: Number,
            }],
        }],
    },
});