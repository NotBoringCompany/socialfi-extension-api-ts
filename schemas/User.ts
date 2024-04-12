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
    inviteCodeData: Object,
    referralCode: String,
    wallet: Object,
    secondaryWallets: Array,
    openedTweetIdsToday: Array,
    inventory: Object,
    inGameData: Object
})