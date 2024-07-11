import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * Quest schema. Represents closely to the `Quest` interface in `models/quest.ts`.
 */
export const QuestSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    questId: Number,
    name: String,
    description: String,
    type: String,
    limit: Number,
    category: String,
    imageUrl: String,
    bannerUrl: String,
    poi: String,
    start: Number,
    end: Number,
    rewards: Array,
    completedBy: [{
        twitterId: String,
        timesCompleted: Number,
        _id: false
    }],
    requirements: Array
})