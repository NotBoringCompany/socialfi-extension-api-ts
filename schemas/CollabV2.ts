import mongoose from 'mongoose';

const CollabRewardSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
});

export const CollabBasketSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    rewards: [CollabRewardSchema],
});

export const CollabParticipantSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: false,
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
        enum: ['Leader', 'Member'],
        required: true,
    },
    community: {
        type: String,
        required: true,
    },
    twitterUsername: {
        type: String,
        required: true,
    },
    discordUsername: {
        type: String,
        required: true,
    },
    basket: {
        type: CollabBasketSchema,
        required: true,
    },
    claimable: {
        type: Boolean,
        required: true,
    },
    approved: {
        type: Boolean,
        required: true,
    },
});
