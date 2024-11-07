import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * User friends schema. Represents closely to the `Friend` interface in `models/friend.ts`.
 */
export const FriendSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    userId1: String,
    userId2: String,
    status: String,
});

FriendSchema.index({ userId1: 1, userId2: 1 });
FriendSchema.index({ userId2: 1, userId1: 1 });
FriendSchema.index({ status: 1 });
