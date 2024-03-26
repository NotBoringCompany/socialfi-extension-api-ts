import mongoose from 'mongoose';

/**
 * User schema. Represents closely to the `User` interface in `models/user.ts`.
 */
export const UserSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: new mongoose.Types.ObjectId()
    },
    twitterId: String,
    wallet: Object,
    openedTweetIdsToday: Array,
    inventory: Object,
    stats: Object
})