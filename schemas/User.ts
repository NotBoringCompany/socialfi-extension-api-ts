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
    method: String,
    twitterId: {
        type: String,
        index: true
    },
    twitterProfilePicture: String,
    twitterUsername: String,
    twitterDisplayName: String,
    discordProfile: Object,
    telegramProfile: Object,
    createdTimestamp: Number,
    inviteCodeData: Object,
    referralData: Object,
    wallet: Object,
    secondaryWallets: Array,
    openedTweetIdsToday: Array,
    inventory: Object,
    inGameData: Object
})