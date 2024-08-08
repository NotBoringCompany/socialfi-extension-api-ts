import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';
import { QuestRequirement } from '../models/quest';

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

export const QuestSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    questId: {
        type: Number,
        index: true
    },
    name: String,
    description: String,
    type: String,
    tier: String,
    unlockable: Boolean,
    status: { type: Boolean, default: true },
    progression: { type: Boolean, default: false },
    limit: Number,
    category: String,
    imageUrl: String,
    bannerUrl: String,
    poi: String,
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
