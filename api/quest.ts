import mongoose from 'mongoose';
import { QuestRequirement, QuestReward, QuestRewardType, QuestType } from '../models/quest';
import { ReturnValue, Status } from '../utils/retVal';
import { QuestSchema } from '../schemas/Quest';
import { generateObjectId } from '../utils/crypto';
import { User, UserInventory } from '../models/user';
import { UserSchema } from '../schemas/User';

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
            message: `(addQuest) Unauthorized. Wrong admin key.`
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
            message: `(addQuest) Quest added.`,
            data: {
                quest: newQuest
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addQuest) ${err.message}`
        }
    }
}

/**
 * Completes a quest for a user and obtain the rewards.
 */
export const completeQuest = async (twitterId: string, questId: number): Promise<ReturnValue> => {
    const Quest = mongoose.model('Quests', QuestSchema, 'Quests');
    const User = mongoose.model('Users', UserSchema, 'Users');

    try {
        const quest = await Quest.findOne({ questId });

        if (!quest) {
            return {
                status: Status.ERROR,
                message: `(completeQuest) Quest not found. Quest ID: ${questId}`
            }
        }

        const user = await User.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(completeQuest) User not found. Twitter ID: ${twitterId}`
            }
        }

        // check if the user has already completed this quest
        const userHasCompletedQuest = quest.completedBy.find((user: User) => user.twitterId === twitterId);

        if (userHasCompletedQuest) {
            return {
                status: Status.ERROR,
                message: `(completeQuest) User has already completed this quest. Quest ID: ${questId}`
            }
        }

        // add the user to the `completedBy` array
        await Quest.updateOne({ id: questId }, { $push: { completedBy: twitterId } });

        // loop through the rewards and add them to the user's inventory
        const rewards: QuestReward[] = quest.rewards;

        for (let i = 0; i < rewards.length; i++) {
            const reward = rewards[i];
            const amount = Math.floor(Math.random() * (reward.maxReceived - reward.minReceived + 1) + reward.minReceived);

            // get the reward type and see if the user has the following asset in their inventory
            const rewardType: QuestRewardType = reward.rewardType;
            const userInventory: UserInventory = user.inventory;

            switch (rewardType) {
                case QuestRewardType.COOKIES:
                    
            }

        }

    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(completeQuest) ${err.message}`
        }
    }
}