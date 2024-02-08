import mongoose from 'mongoose';
import { QuestRequirement, QuestReward, QuestType } from '../models/quest';
import { ReturnValue, Status } from '../utils/retVal';
import { QuestSchema } from '../schemas/Quest';
import { generateObjectId } from '../utils/crypto';

/**
 * Adds a quest to the database. Requires admin key.
 */
export const addQuest = async (
    name: string,
    description: string,
    type: QuestType,
    imageUrl: string,
    start: number,
    end: number,
    rewards: QuestReward[],
    requirements: QuestRequirement[],
    adminKey: string
): Promise<ReturnValue> => {
    if (adminKey !== process.env.ADMIN_KEY) {
        return {
            status: Status.UNAUTHORIZED,
            message: 'Unauthorized. Wrong admin key.'
        }
    }

    const Quest = mongoose.model('Quests', QuestSchema, 'Quests');

    // get the amount of quests in the database to determine the `id` number
    const questCount = await Quest.countDocuments();

    try {
        const newQuest = new Quest({
            _id: generateObjectId(),
            id: questCount + 1,
            name,
            description,
            type,
            imageUrl,
            start,
            end,
            rewards,
            requirements
        });

        await newQuest.save();

        return {
            status: Status.SUCCESS,
            message: 'Quest added.',
            data: {
                quest: newQuest
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: err.message
        }
    }
}