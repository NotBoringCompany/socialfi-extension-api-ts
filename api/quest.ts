import mongoose from 'mongoose';
import { QuestRequirement, QuestReward, QuestRewardType, QuestType } from '../models/quest';
import { ReturnValue, Status } from '../utils/retVal';
import { QuestSchema } from '../schemas/Quest';
import { generateObjectId } from '../utils/crypto';
import { User, UserInventory } from '../models/user';
import { UserSchema } from '../schemas/User';
import { Food } from '../models/food';
import { RANDOMIZE_FOOD_FROM_QUEST } from '../utils/constants/quest';

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
            completedBy: [],
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
 * 
 * TO DO: implement quest requirements check
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
                // add the cookie count into the user's inventory
                case QuestRewardType.X_COOKIES:
                    await User.updateOne({ twitterId }, { $inc: { 'inventory.xCookies': amount } });
                    break;
                // add the food into the user's inventory
                case QuestRewardType.FOOD:
                    // get the corresponding food type by probability
                    const food = RANDOMIZE_FOOD_FROM_QUEST();
                    // check if the food already exists in the user's inventory of `foods`
                    const foodIndex = userInventory.foods.findIndex((f: Food) => f.type === food);
                    // if the food exists, increment the amount; otherwise, push the food into the inventory
                    if (foodIndex !== -1) {
                        await User.updateOne({ twitterId }, { $inc: { [`inventory.foods.${foodIndex}.amount`]: amount } });
                    } else {
                        await User.updateOne({ twitterId }, { $push: { 'inventory.foods': { type: food, amount } } });
                    }

                    break;
                // if default, return an error (shouldn't happen)
                default:
                    return {
                        status: Status.ERROR,
                        message: `(completeQuest) Unknown reward type: ${rewardType}`
                    }
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(completeQuest) Quest completed. Rewards received and added to user's inventory.`,
            data: {
                questId,
                rewards
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(completeQuest) ${err.message}`
        }
    }
}

/**
 * Fetches all quests from the database.
 */
export const getQuests = async (): Promise<ReturnValue> => {
    const Quest = mongoose.model('Quests', QuestSchema, 'Quests');

    try {
        const quests = await Quest.find();

        if (quests.length === 0 || !quests) {
            return {
                status: Status.ERROR,
                message: `(getQuests) No quests found.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getQuests) Quests fetched.`,
            data: {
                quests
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getQuests) ${err.message}`
        }
    }
}

/**
 * Deletes a quest from the database. Requires admin key.
 */
export const deleteQuest = async (questId: number, adminKey: string): Promise<ReturnValue> => {
    const Quest = mongoose.model('Quests', QuestSchema, 'Quests');

    try {
        if (adminKey !== process.env.ADMIN_KEY) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(deleteQuest) Unauthorized. Wrong admin key.`
            }
        }

        const quest = await Quest.findOne({ questId });

        if (!quest) {
            return {
                status: Status.ERROR,
                message: `(deleteQuest) Quest not found. Quest ID: ${questId}`
            }
        }

        await Quest.deleteOne({ questId });

        return {
            status: Status.SUCCESS,
            message: `(deleteQuest) Quest deleted.`,
            data: {
                questId
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(deleteQuest) ${err.message}`
        }
    }
}

/**
 * Gets all quests that a user has completed.
 */
export const getUserCompletedQuests = async (twitterId: string): Promise<ReturnValue> => {
    const Quest = mongoose.model('Quests', QuestSchema, 'Quests');

    try {
        const completedQuests = await Quest.find({ completedBy: twitterId });

        return {
            status: Status.SUCCESS,
            message: `(getUserCompletedQuests) Quests fetched.`,
            data: {
                // even if the user hasn't completed any quests, return an empty array
                completedQuests
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getUserCompletedQuests) ${err.message}`
        }
    }
}