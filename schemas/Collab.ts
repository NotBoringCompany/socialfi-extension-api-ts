import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * CollabReward schema. Represents a reward given to a KOL or group member.
 */
const CollabRewardSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
        default: generateObjectId(),
    },
    type: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
});

/**
 * Participant schema. Represents a participant in a KOL or group tier.
 */
const ParticipantSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
        default: generateObjectId(),
    },
    name: {
        type: String,
        required: true,
    },
    code: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['leader', 'member'],
        required: true,
    },
    twitterUsername: {
        type: String,
        required: true,
    },
    discordId: {
        type: String,
        required: true,
    },
    claimable: {
        type: Boolean,
        default: false,
    },
    approved: {
        type: Boolean,
        default: false,
    },
});

/**
 * Group schema. Represents a group in a group tier.
 */
const GroupSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
        default: generateObjectId(),
    },
    name: {
        type: String,
        required: true,
    },
    code: {
        type: String,
        required: true,
    },
    participants: [ParticipantSchema],
});

/**
 * Collab schema. Represents a collab reward tier.
 */
/**
 * KOL Collab schema. Represents a KOL reward tier.
 */
export const CollabSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
        default: generateObjectId(),
    },
    type: {
        type: String,
        required: true,
    },
    tier: {
        type: String,
        required: true,
    },
    leaderRewards: [CollabRewardSchema],
    memberRewards: [CollabRewardSchema],
    participants: [ParticipantSchema],
    groups: [GroupSchema],
});
