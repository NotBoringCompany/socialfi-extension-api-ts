import mongoose from 'mongoose';
import { Quest, QuestCategory, QuestRequirement, QuestRequirementType, QuestReward, QuestRewardType, QuestType } from '../models/quest';
import { ReturnValue, Status } from '../utils/retVal';
import { QuestSchema } from '../schemas/Quest';
import { generateObjectId } from '../utils/crypto';
import { ExtendedXCookieData, User, UserInventory, XCookieSource } from '../models/user';
import { UserSchema } from '../schemas/User';
import { Food } from '../models/food';
import { RANDOMIZE_FOOD_FROM_QUEST } from '../utils/constants/quest';
import { QuestModel, UserModel } from '../utils/constants/db';

/**
 * Adds a quest to the database. Requires admin key.
 */
export const addQuest = async (
    name: string,
    description: string,
    type: QuestType,
    category: QuestCategory,
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

    // get the amount of quests in the database to determine the `id` number
    const questCount = await QuestModel.countDocuments();

    try {
        const newQuest = new QuestModel({
            _id: generateObjectId(),
            questId: questCount + 1,
            name,
            description,
            type,
            category,
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
    try {
        const [quest, user] = await Promise.all([
            QuestModel.findOne({ questId }).lean(),
            UserModel.findOne({ twitterId }).lean()
        ]);

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const questUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        if (!quest) {
            return {
                status: Status.ERROR,
                message: `(completeQuest) Quest not found. Quest ID: ${questId}`
            }
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(completeQuest) User not found. Twitter ID: ${twitterId}`
            }
        }

        // check if the user has already completed this quest
        const userHasCompletedQuest = quest.completedBy.find((user: User) => user.twitterId === twitterId);

        console.log(`(completeQuest) User ${twitterId} has completed quest ${questId}: ${userHasCompletedQuest}`);

        if (userHasCompletedQuest) {
            return {
                status: Status.ERROR,
                message: `(completeQuest) User has already completed this quest. Quest ID: ${questId}`
            }
        }

        // add the user to the `completedBy` array
        questUpdateOperations.$push['completedBy'] = twitterId;

        // Check quest requirement
        const { status: requirementStatus } = await checkQuestRequirement(twitterId, questId);

        if (requirementStatus === Status.ERROR) {
            return {
                status: Status.BAD_REQUEST,
                message: `(completeQuest) User not fulfilled the quest requirements. Quest ID: ${questId}`
            }
        }

        // loop through the rewards and add them to the user's inventory
        const rewards: QuestReward[] = quest.rewards;

        // the actual reward types and amounts obtained by the user (e.g. if food => then burger or chocolate etc)
        let obtainedRewards = [];

        for (let i = 0; i < rewards.length; i++) {
            const reward = rewards[i];
            const amount = Math.floor(Math.random() * (reward.maxReceived - reward.minReceived + 1) + reward.minReceived);

            // get the reward type and see if the user has the following asset in their inventory
            const rewardType: QuestRewardType = reward.rewardType;
            const userInventory: UserInventory = user.inventory;

            switch (rewardType) {
                // add the cookie count into the user's inventory
                case QuestRewardType.X_COOKIES:
                    userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = amount;

                    // check if the user's `xCookieData.extendedXCookieData` contains a source called QUEST_REWARDS.
                    // if yes, we increment the amount, if not, we create a new entry for the source
                    const questRewardsIndex = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(data => data.source === XCookieSource.QUEST_REWARDS);

                    if (questRewardsIndex !== -1) {
                        userUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${questRewardsIndex}.xCookies`] = amount;
                    } else {
                        userUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = {
                            xCookies: amount,
                            source: XCookieSource.QUEST_REWARDS
                        }
                    }
                    
                    obtainedRewards.push({ type: rewardType, amount });
                    break;
                // add the food into the user's inventory
                case QuestRewardType.FOOD:
                    // get the corresponding food type by probability
                    const food = RANDOMIZE_FOOD_FROM_QUEST();
                    // check if the food already exists in the user's inventory of `foods`
                    const foodIndex = userInventory.foods.findIndex((f: Food) => f.type === food);
                    // if the food exists, increment the amount; otherwise, push the food into the inventory
                    if (foodIndex !== -1) {
                        userUpdateOperations.$inc[`inventory.foods.${foodIndex}.amount`] = amount;
                    } else {
                        userUpdateOperations.$push['inventory.foods'] = { type: food, amount };
                    }

                    obtainedRewards.push({ type: food, amount });
                    break;
                // if default, return an error (shouldn't happen)
                default:
                    return {
                        status: Status.ERROR,
                        message: `(completeQuest) Unknown reward type: ${rewardType}`
                    }
            }
        }

        // add the twitter id to the quest's `completedBy` array
        questUpdateOperations.$push['completedBy'] = twitterId;

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            QuestModel.updateOne({ questId }, questUpdateOperations)
        ]);

        return {
            status: Status.SUCCESS,
            message: `(completeQuest) Quest completed. Rewards received and added to user's inventory.`,
            data: {
                questId,
                rewards: obtainedRewards
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
export const getQuests = async (category?: string): Promise<ReturnValue> => {
    try {
        const query = {};

        if (category) query['category'] = category;

        const quests = await QuestModel.find(query).lean();

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
    try {
        if (adminKey !== process.env.ADMIN_KEY) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(deleteQuest) Unauthorized. Wrong admin key.`
            }
        }

        const quest = await QuestModel.findOne({ questId }).lean();

        if (!quest) {
            return {
                status: Status.ERROR,
                message: `(deleteQuest) Quest not found. Quest ID: ${questId}`
            }
        }

        await QuestModel.deleteOne({ questId });

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
    try {
        const completedQuests = await QuestModel.find({ completedBy: twitterId }).lean();

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

export const checkQuestRequirement = async (twitterId: string, questId: number): Promise<ReturnValue> => {
    try {
        // NOTICE: duplicate query, might need refactor
        const [quest, user] = await Promise.all([
            QuestModel.findOne({ questId }).lean(),
            UserModel.findOne({ twitterId }).lean()
        ]);

        if (!quest) {
            return {
                status: Status.ERROR,
                message: `(checkQuestRequirement) Quest not found. Quest ID: ${questId}`
            }
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(checkQuestRequirement) User not found. Twitter ID: ${twitterId}`
            }
        }

        for (const requirement of quest.requirements) {
            switch (requirement.type) {
                case QuestRequirementType.COMPLETE_TUTORIAL:
                    if (!user.inGameData.completedTutorialIds.includes(requirement.parameters.tutorialId)) {
                        return {
                            status: Status.ERROR,
                            message: `(checkQuestRequirement) User not fulfilled the quest requirements.`
                        }
                    }
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(checkQuestRequirement) User fulfilled the quest requirements.`,
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(checkQuestRequirement) ${err.message}`
        }
    }
}