import mongoose from 'mongoose';

/**
 * Quest schema. Represents closely to the `Quest` interface in `models/quest.ts`.
 */
export const QuestSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: new mongoose.Types.ObjectId()
    },
    questId: Number,
    name: String,
    description: String,
    type: String,
    imageUrl: String,
    start: Number,
    end: Number,
    rewards: Array,
    completedBy: Array
})