import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * User schema. Represents closely to the `User` interface in `models/user.ts`.
 */
export const UserSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId()
    },
    twitterId: String,
    twitterProfilePicture: String,
    createdTimestamp: Number,
    inviteCodeData: Object,
    referralData: Object,
    wallet: Object,
    secondaryWallets: Array,
    openedTweetIdsToday: Array,
    inventory: Object,
    inGameData: Object
})