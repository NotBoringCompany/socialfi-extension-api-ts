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
 * KOL Collab schema. Represents a KOL reward tier.
 */
export const KOLCollabSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
        default: generateObjectId(),
    },
    tier: {
        type: String,
        required: true,
    },
    maxUsers: {
        type: Number,
        required: true,
    },
    rewards: [CollabRewardSchema],
    participants: [ParticipantSchema],
});

/**
 * Group Collab schema. Represents a group reward tier.
 */
export const GroupCollabSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
        default: generateObjectId(),
    },
    tier: {
        type: String,
        required: true,
    },
    maxGroups: {
        type: Number,
        default: null,
    },
    maxMembers: {
        type: Number,
        default: null,
    },
    leaderRewards: [CollabRewardSchema],
    memberRewards: [CollabRewardSchema],
    groups: [GroupSchema],
});
