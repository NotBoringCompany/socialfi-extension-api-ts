import mongoose from 'mongoose';
import { Quest, QuestCategory, QuestRequirement, QuestRequirementType, QuestReward, QuestRewardType, QuestType } from '../models/quest';
import { ReturnValue, Status } from '../utils/retVal';
import { QuestSchema } from '../schemas/Quest';
import { generateObjectId } from '../utils/crypto';
import { ExtendedXCookieData, User, UserInventory, XCookieSource } from '../models/user';
import { UserSchema } from '../schemas/User';
import { Food } from '../models/food';
import { RANDOMIZE_FOOD_FROM_QUEST } from '../utils/constants/quest';
import { IslandModel, QuestModel, UserModel } from '../utils/constants/db';
import { Bit, BitRarity } from '../models/bit';
import { RANDOMIZE_GENDER, getBitStatsModifiersFromTraits, randomizeBitTraits, randomizeBitType } from '../utils/constants/bit';
import { addBitToDatabase, getLatestBitId, randomizeFarmingStats } from './bit';
import { ObtainMethod } from '../models/obtainMethod';
import { Modifier } from '../models/modifier';

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

        const islandUpdateOperations: Array<{
            islandId: number,
            updateOperations: {
                $pull: {},
                $inc: {},
                $set: {},
                $push: {}
            }
        }> = [];

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
                // give user bit, TODO: might need to add looping for the amount bit rewarded
                case QuestRewardType.BIT:
                    const rarity = BitRarity.COMMON;
                    const bitType = randomizeBitType();

                    const traits = randomizeBitTraits(rarity);

                    const bitStatsModifiers = getBitStatsModifiersFromTraits(traits.map((trait) => trait.trait));

                    // get the latest bit ID from the database
                    const { status: bitIdStatus, message: bitIdMessage, data: bitIdData } = await getLatestBitId();
                    if (bitIdStatus !== Status.SUCCESS) {
                        return {
                            status: Status.ERROR,
                            message: `(completeQuest) Error from getLatestBitId: ${bitIdMessage}`,
                        }
                    }

                    // create a new Bit instance
                    const newBit: Bit = {
                        bitId: bitIdData?.latestBitId + 1,
                        bitType: randomizeBitType(),
                        bitNameData: {
                            name: bitType,
                            lastChanged: 0,
                        },
                        rarity,
                        gender: RANDOMIZE_GENDER(),
                        premium: true,
                        owner: user._id,
                        purchaseDate: Math.floor(Date.now() / 1000),
                        obtainMethod: ObtainMethod.QUEST,
                        placedIslandId: 0,
                        lastRelocationTimestamp: 0,
                        currentFarmingLevel: 1, // starts at level 1
                        traits,
                        farmingStats: randomizeFarmingStats(rarity),
                        bitStatsModifiers
                    }

                    // add a premium common bit to the user's inventory (users get 1 for free when they sign up)
                    const {
                        status: bitStatus,
                        message: bitMessage,
                        data: bitData,
                    } = await addBitToDatabase(newBit);

                    if (bitStatus !== Status.SUCCESS) {
                        return {
                            status: Status.ERROR,
                            message: `(completeTutorial) Error from addBitToDatabase: ${bitMessage}`,
                        }
                    }

                    // get the user's list of owned islands
                    const islands = user.inventory?.islandIds as number[];

                    // check if the bit has the infuential, antagonistic, famous or mannerless traits
                    const hasInfluentialTrait = newBit.traits.some(trait => trait.trait === 'Influential');
                    const hasAntagonisticTrait = newBit.traits.some(trait => trait.trait === 'Antagonistic');
                    const hasFamousTrait = newBit.traits.some(trait => trait.trait === 'Famous');
                    const hasMannerlessTrait = newBit.traits.some(trait => trait.trait === 'Mannerless');

                    // if bit has influential trait, add 1% working rate to all islands owned by the user
                    // if bit has antagonistic trait, reduce 1% working rate to all islands owned by the user
                    // if bit has famous trait, add 0.5% working rate to all islands owned by the user
                    // if bit has mannerless trait, reduce 0.5% working rate to all islands owned by the user
                    if (hasInfluentialTrait || hasAntagonisticTrait || hasFamousTrait || hasMannerlessTrait) {
                        const gatheringRateModifier: Modifier = {
                            origin: `Bit ID #${newBit.bitId}'s Trait: ${hasInfluentialTrait ? 'Influential' : hasAntagonisticTrait ? 'Antagonistic' : hasFamousTrait ? 'Famous' : 'Mannerless'}`,
                            value: hasInfluentialTrait ? 1.01 : hasAntagonisticTrait ? 0.99 : hasFamousTrait ? 1.005 : 0.995
                        }
                        const earningRateModifier: Modifier = {
                            origin: `Bit ID #${newBit.bitId}'s Trait: ${hasInfluentialTrait ? 'Influential' : hasAntagonisticTrait ? 'Antagonistic' : hasFamousTrait ? 'Famous' : 'Mannerless'}`,
                            value: hasInfluentialTrait ? 1.01 : hasAntagonisticTrait ? 0.99 : hasFamousTrait ? 1.005 : 0.995
                        }

                        for (const islandId of islands) {
                            islandUpdateOperations.push({
                                islandId,
                                updateOperations: {
                                    $push: {
                                        'islandStatsModifiers.gatheringRateModifiers': gatheringRateModifier,
                                        'islandStatsModifiers.earningRateModifiers': earningRateModifier
                                    },
                                    $set: {},
                                    $pull: {},
                                    $inc: {}
                                }
                            });
                        }
                    }

                    userUpdateOperations.$push['inventory.bitIds'] = newBit.bitId;

                    obtainedRewards.push({ type: rewardType, amount, data: bitData });

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

        // create an array of promises for updating the islands
        const islandUpdatePromises = islandUpdateOperations.map(async op => {
            return IslandModel.updateOne({ islandId: op.islandId }, op.updateOperations);
        });

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            QuestModel.updateOne({ questId }, questUpdateOperations),
            ...islandUpdatePromises
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