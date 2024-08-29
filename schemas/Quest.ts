import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';
import { Quest, QuestDaily, QuestRequirement } from '../models/quest';
import { POIName } from '../models/poi';

const QuestRequirementSchema = new mongoose.Schema<QuestRequirement & Document>({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    type: String,
    description: String,
    parameters: Object,
});

export const QuestProgressionSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    questId: { type: String, index: true },
    requirementId: { type: String, index: true },
    userId: { type: String, index: true },
    progress: { type: Number, default: 0 },
    requirement: { type: Number, default: 0 },
});

export const QuestSchema = new mongoose.Schema<Quest & Document>({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    questId: Number,
    name: String,
    description: String,
    type: String,
    tier: String,
    unlockable: Boolean,
    acceptable: Boolean,
    status: { type: Boolean, default: true },
    progression: { type: Boolean, default: false },
    limit: Number,
    category: String,
    imageUrl: String,
    bannerUrl: String,
    poi: [String],
    start: Number,
    end: Number,
    rewards: Array,
    completedBy: [
        {
            _id: false,
            twitterId: String,
            timesCompleted: Number,
        },
    ],
    requirements: [QuestRequirementSchema],
    qualifiedUsers: [String],
    qualification: {
        questId: Number,
        level: Number,
    },
});

export const QuestDailySchema = new mongoose.Schema<QuestDaily & Document>({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    quest: { type: String, ref: 'Quests', required: true, index: true },
    user: { type: String, ref: 'Users', required: true, index: true },
    accepted: { type: Boolean, required: true },
    claimed: { type: Boolean, required: true },
    poi: { type: String, enum: Object.values(POIName), default: null, index: true },
    createdAt: { type: Number, required: true },
    expiredAt: { type: Number, required: true },
    acceptedAt: { type: Number },
    claimedAt: { type: Number },
});
