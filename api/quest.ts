import mongoose from 'mongoose';
import {
    Quest,
    QuestCategory,
    QuestDaily,
    QuestRequirement,
    QuestRequirementType,
    QuestReward,
    QuestRewardType,
    QuestType,
} from '../models/quest';
import { ReturnValue, Status } from '../utils/retVal';
import { generateObjectId } from '../utils/crypto';
import { ExtendedXCookieData, UserInventory, XCookieSource } from '../models/user';
import { Food, FoodType } from '../models/food';
import { DAILY_QUEST_LAPSE_PHASE, DAILY_QUEST_PER_POI, MAX_DAILY_QUEST_ACCEPTABLE } from '../utils/constants/quest';
import { IslandModel, QuestDailyModel, QuestModel, QuestProgressionModel, UserModel } from '../utils/constants/db';
import { Bit, BitRarity } from '../models/bit';
import {
    RANDOMIZE_GENDER,
    getBitStatsModifiersFromTraits,
    randomizeBitTraits,
    randomizeBitType,
} from '../utils/constants/bit';
import { addBitToDatabase, getLatestBitId, randomizeFarmingStats } from './bit';
import { ObtainMethod } from '../models/obtainMethod';
import { Modifier } from '../models/modifier';
import { BoosterItem } from '../models/booster';
import { ExtendedResource } from '../models/resource';
import { POIName } from '../models/poi';
import { TwitterHelper } from '../utils/twitterHelper';
import { dayjs } from '../utils/dayjs';

/**
 * Adds a quest to the database.
 */
export const addQuest = async (quest: Quest): Promise<ReturnValue> => {
    const latestQuest = await QuestModel.findOne().sort({ questId: -1 }).lean();

    try {
        const newQuest = new QuestModel({
            _id: generateObjectId(),
            questId: latestQuest.questId + 1,
            ...quest,
            requirements: quest.requirements.map((item) => ({
                ...item,
                _id: generateObjectId(),
            })),
        });

        await newQuest.save();

        return {
            status: Status.SUCCESS,
            message: `(addQuest) Quest added.`,
            data: {
                quest: newQuest,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addQuest) ${err.message}`,
        };
    }
};

/**
 * Completes a quest for a user and obtain the rewards.
 *
 * TO DO: implement quest requirements check
 */
export const completeQuest = async (twitterId: string, questId: number): Promise<ReturnValue> => {
    try {
        const [quest, user] = await Promise.all([
            QuestModel.findOne({ questId }).lean(),
            UserModel.findOne({ twitterId }).lean(),
        ]);

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {},
        };

        const islandUpdateOperations: Array<{
            islandId: number;
            updateOperations: {
                $pull: {};
                $inc: {};
                $set: {};
                $push: {};
            };
        }> = [];

        const questUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {},
        };

        if (!quest) {
            return {
                status: Status.ERROR,
                message: `(completeQuest) Quest not found. Quest ID: ${questId}`,
            };
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(completeQuest) User not found. Twitter ID: ${twitterId}`,
            };
        }

        // check the POI allowance for the quest. if 'anywhere', then continue.
        // else, check if the user is in the correct POI to complete the quest. if not, return an error.
        if (quest.poi && quest.poi !== null && !quest.poi.includes(user.inGameData?.location as POIName)) {
            return {
                status: Status.ERROR,
                message: `(completeQuest) User is not in the correct POI to complete the quest. Quest ID: ${questId}`,
            };
        }

        // Check quest requirement (optional for quests that have to be completed outside of this function)
        const { status: requirementStatus } = await checkQuestRequirements(twitterId, questId);

        if (requirementStatus === Status.ERROR) {
            return {
                status: Status.BAD_REQUEST,
                message: `(completeQuest) User has not fulfilled the quest requirements. Quest ID: ${questId}`,
            };
        }

        /// TO DO:
        /// 1. FOR RESOURCE QUESTS, REMOVE THE RESOURCE FROM THE USER'S INVENTORY
        /// 2. FOR TWITTER-RELATED QUESTS, ADD THE FOLLOWING/TWEET CHECKS HERE
        const requirements: QuestRequirement[] = quest.requirements;

        for (let i = 0; i < requirements.length; i++) {
            const requirement = requirements[i];

            if (requirement.type === QuestRequirementType.RESOURCE_SUBMISSION) {
                // the inventory weight of the user will be reduced by the total weight of the resources required
                let inventoryWeightToReduce = 0;

                // check what resources need to be submitted over
                const resources = requirement.parameters.resources ?? [];

                if (resources.length === 0) {
                    return {
                        status: Status.ERROR,
                        message: `(completeQuest) Quest requires resources to be submitted. Quest ID: ${questId}`,
                    };
                }

                // check if the user has the required resources
                for (let j = 0; j < resources.length; j++) {
                    const resource = resources[j];

                    const resourceType = resource.resourceType;
                    const resourceAmount = resource.amount;

                    const userResourceIndex = (user.inventory.resources as ExtendedResource[]).findIndex(
                        (r) => r.type === resourceType
                    );

                    if (userResourceIndex === -1) {
                        return {
                            status: Status.ERROR,
                            message: `(completeQuest) User does not have the required resources. Quest ID: ${questId}`,
                        };
                    }

                    // check if the user has enough resources
                    if (user.inventory.resources[userResourceIndex].amount < resourceAmount) {
                        return {
                            status: Status.ERROR,
                            message: `(completeQuest) User does not have enough of one or more of the required resources. Quest ID: ${questId}`,
                        };
                    }

                    // remove the resources from the user's inventory
                    userUpdateOperations.$inc[`inventory.resources.${userResourceIndex}.amount`] = -resourceAmount;

                    // increment the inventory weight to reduce
                    inventoryWeightToReduce +=
                        (user.inventory.resources as ExtendedResource[])[userResourceIndex].weight * resource.amount;
                }

                console.log('user current weight: ', user.inventory.weight);
                console.log('(completeQuest) Inventory weight to reduce:', inventoryWeightToReduce);

                // reduce the user's inventory weight
                userUpdateOperations.$inc['inventory.weight'] = -inventoryWeightToReduce;
            }
        }

        if (quest.type === QuestType.DAILY) {
            const dailyQuest = await QuestDailyModel.findOne({ quest: quest._id, user: user._id });

            if (!dailyQuest) {
                return {
                    status: Status.ERROR,
                    message: `(completeQuest) Daily Quest not found`,
                };
            }
        } else {
            // check if the user has already completed this quest
            // to do this:
            // 1. get the `completedBy` array from the quest
            // 2. check if the user's twitter id is in the array. if it is:
            // 3. check if `timesCompleted` is equal to the quest's `limit`. if not, then the user can complete the quest again
            // 4. if yes, then the user has already completed the quest
            const userHasCompletedQuestAtLeastOnce = quest.completedBy.find((user) => user.twitterId === twitterId);
            const userHasCompletedQuest =
                userHasCompletedQuestAtLeastOnce && userHasCompletedQuestAtLeastOnce.timesCompleted >= quest.limit;

            console.log(`(completeQuest) User ${twitterId} has completed quest ${questId}: ${userHasCompletedQuest}`);

            if (userHasCompletedQuest) {
                return {
                    status: Status.ERROR,
                    message: `(completeQuest) User has already completed this quest. Quest ID: ${questId}`,
                };
            }

            // if user doesn't exist in the `completedBy` array, add the user to the array and set `timesCompleted` to 1
            // else, increment the `timesCompleted` by 1
            if (!userHasCompletedQuestAtLeastOnce) {
                questUpdateOperations.$push['completedBy'] = { twitterId, timesCompleted: 1 };
            } else {
                const userIndex = quest.completedBy.findIndex((user) => user.twitterId === twitterId);

                questUpdateOperations.$inc[`completedBy.${userIndex}.timesCompleted`] = 1;
            }
        }

        // loop through the rewards and add them to the user's inventory
        const rewards: QuestReward[] = quest.rewards;

        // the actual reward types and amounts obtained by the user (e.g. if food => then burger or chocolate etc)
        let obtainedRewards = [];

        for (let i = 0; i < rewards.length; i++) {
            const reward = rewards[i];
            const amount = Math.floor(
                Math.random() * (reward.maxReceived - reward.minReceived + 1) + reward.minReceived
            );

            // get the reward type and see if the user has the following asset in their inventory
            const rewardType: QuestRewardType = reward.rewardType;
            const userInventory: UserInventory = user.inventory;

            switch (rewardType) {
                // add the cookie count into the user's inventory
                case QuestRewardType.X_COOKIES:
                    userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = amount;

                    // check if the user's `xCookieData.extendedXCookieData` contains a source called QUEST_REWARDS.
                    // if yes, we increment the amount, if not, we create a new entry for the source
                    const questRewardsIndex = (
                        user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]
                    ).findIndex((data) => data.source === XCookieSource.QUEST_REWARDS);

                    if (questRewardsIndex !== -1) {
                        userUpdateOperations.$inc[
                            `inventory.xCookieData.extendedXCookieData.${questRewardsIndex}.xCookies`
                        ] = amount;
                    } else {
                        userUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = {
                            xCookies: amount,
                            source: XCookieSource.QUEST_REWARDS,
                        };
                    }

                    obtainedRewards.push({ type: rewardType, amount });
                    break;
                // give user a bit, TODO: might need to add looping for the amount of bits rewarded
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
                        };
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
                        bitStatsModifiers,
                    };

                    // add a premium common bit to the user's inventory (users get 1 for free when they sign up)
                    const { status: bitStatus, message: bitMessage, data: bitData } = await addBitToDatabase(newBit);

                    if (bitStatus !== Status.SUCCESS) {
                        return {
                            status: Status.ERROR,
                            message: `(completeTutorial) Error from addBitToDatabase: ${bitMessage}`,
                        };
                    }

                    // get the user's list of owned islands
                    const islands = user.inventory?.islandIds as number[];

                    // check if the bit has the infuential, antagonistic, famous or mannerless traits
                    const hasInfluentialTrait = newBit.traits.some((trait) => trait.trait === 'Influential');
                    const hasAntagonisticTrait = newBit.traits.some((trait) => trait.trait === 'Antagonistic');
                    const hasFamousTrait = newBit.traits.some((trait) => trait.trait === 'Famous');
                    const hasMannerlessTrait = newBit.traits.some((trait) => trait.trait === 'Mannerless');

                    // if bit has influential trait, add 1% working rate to all islands owned by the user
                    // if bit has antagonistic trait, reduce 1% working rate to all islands owned by the user
                    // if bit has famous trait, add 0.5% working rate to all islands owned by the user
                    // if bit has mannerless trait, reduce 0.5% working rate to all islands owned by the user
                    if (hasInfluentialTrait || hasAntagonisticTrait || hasFamousTrait || hasMannerlessTrait) {
                        const gatheringRateModifier: Modifier = {
                            origin: `Bit ID #${newBit.bitId}'s Trait: ${
                                hasInfluentialTrait
                                    ? 'Influential'
                                    : hasAntagonisticTrait
                                    ? 'Antagonistic'
                                    : hasFamousTrait
                                    ? 'Famous'
                                    : 'Mannerless'
                            }`,
                            value: hasInfluentialTrait
                                ? 1.01
                                : hasAntagonisticTrait
                                ? 0.99
                                : hasFamousTrait
                                ? 1.005
                                : 0.995,
                        };
                        const earningRateModifier: Modifier = {
                            origin: `Bit ID #${newBit.bitId}'s Trait: ${
                                hasInfluentialTrait
                                    ? 'Influential'
                                    : hasAntagonisticTrait
                                    ? 'Antagonistic'
                                    : hasFamousTrait
                                    ? 'Famous'
                                    : 'Mannerless'
                            }`,
                            value: hasInfluentialTrait
                                ? 1.01
                                : hasAntagonisticTrait
                                ? 0.99
                                : hasFamousTrait
                                ? 1.005
                                : 0.995,
                        };

                        for (const islandId of islands) {
                            islandUpdateOperations.push({
                                islandId,
                                updateOperations: {
                                    $push: {
                                        'islandStatsModifiers.gatheringRateModifiers': gatheringRateModifier,
                                        'islandStatsModifiers.earningRateModifiers': earningRateModifier,
                                    },
                                    $set: {},
                                    $pull: {},
                                    $inc: {},
                                },
                            });
                        }
                    }

                    userUpdateOperations.$push['inventory.bitIds'] = newBit.bitId;

                    obtainedRewards.push({ type: rewardType, amount, data: bitData });

                    break;
                // Default case when rewardType isn't X_COOKIES or BIT
                default:
                    // Check if the reward type is a part of FoodType
                    if (Object.values(FoodType).includes(rewardType.toString() as FoodType)) {
                        // check if the food already exists in the user's inventory of `foods`
                        const foodIndex = userInventory.foods.findIndex((f: Food) => f.type === rewardType.toString());
                        // if the food exists, increment the amount; otherwise, push the food into the inventory
                        if (foodIndex !== -1) {
                            userUpdateOperations.$inc[`inventory.foods.${foodIndex}.amount`] = amount;
                        } else {
                            userUpdateOperations.$push['inventory.foods'] = { type: rewardType.toString(), amount };
                        }

                        obtainedRewards.push({ type: rewardType.toString(), amount });
                        break;
                    }
                    // Check if the reward type is a part of BoosterItem
                    else if (Object.values(BoosterItem).includes(rewardType.toString() as BoosterItem)) {
                        // check if the user's `inventory.items` contain a BoosterItem
                        const boosterIndex = userInventory.items.findIndex(
                            (item) => item.type === rewardType.toString()
                        );

                        // if the user has the booster, increment the amount; otherwise, push the booster into the inventory
                        if (boosterIndex !== -1) {
                            userUpdateOperations.$inc[`inventory.items.${boosterIndex}.amount`] = amount;
                        } else {
                            userUpdateOperations.$push['inventory.items'] = {
                                type: BoosterItem.GATHERING_PROGRESS_BOOSTER_25,
                                amount,
                                totalAmountConsumed: 0,
                                weeklyAmountConsumed: 0,
                            };
                        }

                        obtainedRewards.push({ type: rewardType, amount });
                        break;
                    }
                    // Return Error if all Condition is false
                    else {
                        return {
                            status: Status.ERROR,
                            message: `(completeQuest) Unknown reward type: ${rewardType}`,
                        };
                    }
            }
        }

        // create an array of promises for updating the islands
        const islandUpdatePromises = islandUpdateOperations.map(async (op) => {
            return IslandModel.updateOne({ islandId: op.islandId }, op.updateOperations);
        });

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            QuestModel.updateOne({ questId }, questUpdateOperations),
            ...islandUpdatePromises,
        ]);

        if (quest.type === QuestType.DAILY) {
            await QuestDailyModel.updateOne(
                { quest: quest._id, user: user._id },
                { claimed: true, claimedAt: dayjs().unix() }
            );
        }

        // Fetch quests that are unlockable and where the qualification.questId matches the completed questId
        const potentialQuests = await QuestModel.find({
            unlockable: true,
            'qualification.questId': questId,
            status: true,
        }).lean();

        // Check qualifications and update qualified quests
        await Promise.all(
            potentialQuests.map(async (quest) => {
                let isQualified = true;

                // Check if the user meets the level requirement
                if (quest.qualification.level) {
                    isQualified = user.inGameData.level >= quest.qualification.level;
                }

                // If qualified, add the user to the quest's qualifiedUsers
                if (isQualified && !quest.qualifiedUsers.includes(user._id)) {
                    await QuestModel.updateOne({ _id: quest._id }, { $addToSet: { qualifiedUsers: user._id } });
                }
            })
        );

        return {
            status: Status.SUCCESS,
            message: `(completeQuest) Quest completed. Rewards received and added to user's inventory.`,
            data: {
                questId: questId,
                rewards: obtainedRewards,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(completeQuest) ${err.message}`,
        };
    }
};

/**
 * Fetches the quest details along with the user's progression.
 */
export const getQuestProgression = async (questId: string, twitterId: string) => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();
        const quest = await QuestModel.findOne({ questId }).lean();
        if (!quest) {
            return {
                status: Status.ERROR,
                message: `(getQuestProgression) Quest not found.`,
            };
        }

        const requirementsWithProgress = await Promise.all(
            quest.requirements.map(async (req) => {
                const progression = await QuestProgressionModel.findOne({
                    questId: quest._id,
                    userId: user._id,
                    requirementId: req._id,
                }).lean();

                return {
                    ...req,
                    progress: progression ? progression : null,
                };
            })
        );

        const questDetail = {
            ...quest,
            requirements: requirementsWithProgress,
        };

        return {
            status: Status.SUCCESS,
            message: `(getQuestProgression) Quest detail fetched.`,
            data: {
                quest: questDetail,
            },
        };
    } catch (error) {
        return {
            status: Status.ERROR,
            message: `(getQuestProgression) 'Error fetching quest details with progression: ${error}}`,
        };
    }
};

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
                message: `(getQuests) No quests found.`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getQuests) Quests fetched.`,
            data: {
                quests,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getQuests) ${err.message}`,
        };
    }
};

/**
 * Fetches all quests from the database.
 */
export const getUserQuests = async (twitterId: string, category?: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId });
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getUserQuests) User not found. Twitter ID: ${twitterId}`,
            };
        }

        const query: any = {};
        query['status'] = true;
        if (category) query['category'] = category;

        const quests = await QuestModel.find(query).lean();

        if (quests.length === 0) {
            return {
                status: Status.ERROR,
                message: `(getQuests) No quests found.`,
            };
        }

        const filteredQuests = quests.filter((quest) => {
            if (quest.unlockable) {
                return quest.qualifiedUsers.includes(user._id.toString());
            }
            return true;
        });

        const questsWithProgress = await Promise.all(
            filteredQuests.map(async (quest) => {
                const requirementsWithProgress = await Promise.all(
                    quest.requirements.map(async (req) => {
                        const progression = await QuestProgressionModel.findOne({
                            questId: quest._id,
                            userId: user._id,
                            requirementId: req._id,
                        }).lean();

                        return {
                            ...req,
                            progress: progression ?? null,
                        };
                    })
                );

                return {
                    ...quest,
                    requirements: requirementsWithProgress,
                };
            })
        );

        return {
            status: Status.SUCCESS,
            message: `(getQuests) Quests fetched.`,
            data: {
                quests: questsWithProgress,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getQuests) ${err.message}`,
        };
    }
};

/**
 * Deletes a quest from the database. Requires admin key.
 */
export const deleteQuest = async (questId: number, adminKey: string): Promise<ReturnValue> => {
    try {
        if (adminKey !== process.env.ADMIN_KEY) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(deleteQuest) Unauthorized. Wrong admin key.`,
            };
        }

        const quest = await QuestModel.findOne({ questId }).lean();

        if (!quest) {
            return {
                status: Status.ERROR,
                message: `(deleteQuest) Quest not found. Quest ID: ${questId}`,
            };
        }

        await QuestModel.deleteOne({ questId });

        return {
            status: Status.SUCCESS,
            message: `(deleteQuest) Quest deleted.`,
            data: {
                questId,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(deleteQuest) ${err.message}`,
        };
    }
};

/**
 * Gets all quests that a user has completed.
 */
export const getUserCompletedQuests = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const completedQuests = await QuestModel.find({ 'completedBy.twitterId': twitterId }).lean();

        return {
            status: Status.SUCCESS,
            message: `(getUserCompletedQuests) Quests fetched.`,
            data: {
                // even if the user hasn't completed any quests, return an empty array
                completedQuests,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getUserCompletedQuests) ${err.message}`,
        };
    }
};

/**
 * Checks a quest's requirements to see if the user has fulfilled them.
 */
export const checkQuestRequirements = async (twitterId: string, questId: number): Promise<ReturnValue> => {
    try {
        // NOTICE: duplicate query, might need refactoring
        const [quest, user] = await Promise.all([
            QuestModel.findOne({ questId }).lean(),
            UserModel.findOne({ twitterId }).lean(),
        ]);

        if (!quest) {
            return {
                status: Status.ERROR,
                message: `(checkQuestRequirement) Quest not found. Quest ID: ${questId}`,
            };
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(checkQuestRequirement) User not found. Twitter ID: ${twitterId}`,
            };
        }

        for (const [index, requirement] of (quest.requirements as QuestRequirement[]).entries()) {
            switch (requirement.type) {
                case QuestRequirementType.CONNECT_DISCORD:
                    if (!user.discordProfile) {
                        return {
                            status: Status.ERROR,
                            message: `(checkQuestRequirement) User has not fulfilled the quest requirements.`,
                        };
                    }
                    break;
                case QuestRequirementType.COMPLETE_TUTORIAL:
                    if (!user.inGameData.completedTutorialIds.includes(requirement.parameters.tutorialId)) {
                        return {
                            status: Status.ERROR,
                            message: `(checkQuestRequirement) User has not fulfilled the quest requirements.`,
                        };
                    }
                    break;
                case QuestRequirementType.FOLLOW_USER:
                    if (user.method === 'telegram') {
                        return {
                            status: Status.ERROR,
                            message: `(checkQuestRequirement) Failed to check the quest requirements, try again later.`,
                        };
                    }

                    const source = user.twitterUsername;
                    const target = requirement.parameters.twitterUsername;

                    const relationship = await TwitterHelper.getRelationship({
                        source_screen_name: source,
                        target_screen_name: target,
                    });

                    if (relationship.status !== Status.SUCCESS || !relationship.data) {
                        return {
                            status: Status.ERROR,
                            message: `(checkQuestRequirement) Failed to check the quest requirements, try again later.`,
                        };
                    }

                    // check if the user already followed the targeted account
                    if (!relationship.data.source.following) {
                        return {
                            status: Status.ERROR,
                            message: `(checkQuestRequirement) User has not fulfilled the quest requirements.`,
                        };
                    }
                    break;
                case QuestRequirementType.JOIN_SQUAD:
                    if (!user.inGameData.squadId) {
                        return {
                            status: Status.ERROR,
                            message: `(checkQuestRequirement) User has not fulfilled the quest requirements.`,
                        };
                    }

                    break;
                case QuestRequirementType.INVITE_USER:
                    if ((user.referralData?.referredUsersData ?? []).length < (requirement.parameters.count ?? 0)) {
                        return {
                            status: Status.ERROR,
                            message: `(checkQuestRequirement) User has not fulfilled the quest requirements.`,
                        };
                    }

                    break;
                case QuestRequirementType.LOGIN_STREAK:
                    if ((user.inGameData.loginStreak ?? 0) < (requirement.parameters.count ?? 0)) {
                        return {
                            status: Status.ERROR,
                            message: `(checkQuestRequirement) User has not fulfilled the quest requirements.`,
                        };
                    }

                    break;
                case QuestRequirementType.ISLAND_OWNED:
                    if ((user.inventory.islandIds.length ?? 0) < (requirement.parameters.count ?? 0)) {
                        return {
                            status: Status.ERROR,
                            message: `(checkQuestRequirement) User has not fulfilled the quest requirements.`,
                        };
                    }

                    break;
                case QuestRequirementType.LEVEL_UP:
                    if ((user.inGameData.level ?? 0) < (requirement.parameters.count ?? 0)) {
                        return {
                            status: Status.ERROR,
                            message: `(checkQuestRequirement) User has not fulfilled the quest requirements.`,
                        };
                    }

                    break;
                default:
                    if (!quest.progression) break;

                    const progression = await QuestProgressionModel.findOne({
                        questId: quest._id,
                        requirementId: requirement._id,
                        userId: user._id,
                    });

                    if (!progression || progression.progress < progression.requirement) {
                        return {
                            status: Status.ERROR,
                            message: `(checkQuestRequirement) User has not fulfilled the quest requirements.`,
                        };
                    }

                    break;
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(checkQuestRequirement) User fulfilled the quest requirements.`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(checkQuestRequirement) ${err.message}`,
        };
    }
};

/**
 * Retrieve all quests that a user can claim.
 */
export const getUserClaimableQuest = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const uncompletedQuest = await QuestModel.find({ 'completedBy.twitterId': { $ne: twitterId } }).lean();

        // check each quest requirements
        const claimableQuestPromises = uncompletedQuest.map(async (quest) => {
            const { status } = await checkQuestRequirements(twitterId, quest.questId);
            return { quest, status };
        });

        // await all promises
        const claimableQuestResults = await Promise.all(claimableQuestPromises);
        // filter claimable quests
        const claimableQuest = claimableQuestResults
            .filter(({ status }) => status === Status.SUCCESS)
            .map(({ quest }) => quest);

        return {
            status: Status.SUCCESS,
            message: `(getUserCompletedQuests) Quests fetched.`,
            data: {
                claimableQuest,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getUserCompletedQuests) ${err.message}`,
        };
    }
};

/**
 * Updates a quest's data given the quest ID. Admin only.
 */
export const updateQuest = async (questId: string, updatedQuest: Quest): Promise<ReturnValue> => {
    try {
        const quest = await QuestModel.findOne({ questId }).lean();

        if (!quest) {
            return {
                status: Status.ERROR,
                message: `(updateQuest) Quest not found. Quest ID: ${questId}`,
            };
        }

        await QuestModel.updateOne({ _id: questId }, updatedQuest);

        return {
            status: Status.SUCCESS,
            message: `(updateQuest) Quest updated.`,
            data: {
                questId,
                updatedFields: quest,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(updateQuest) ${err.message}`,
        };
    }
};

/**
 * Increments the progress of a quest requirement for a specific user.
 * Intentinonally ignore the validation & error catching for speed up the process
 */
export const incrementProgression = async (
    questId: string,
    requirementId: string,
    twitterId: string,
    count: number
): Promise<void> => {
    try {
        const user = await UserModel.findOne({ twitterId });

        await QuestProgressionModel.updateOne(
            { questId, requirementId, userId: user._id },
            { $inc: { progress: count } },
            { upsert: true }
        );
    } catch (error) {
        // intentionally ignore the error
    }
};

/**
 * Decrements the progress of a quest requirement for a specific user.
 * Intentinonally ignore the validation & error catching for speed up the process
 */
export const decrementProgression = async (
    questId: string,
    requirementId: string,
    twitterId: string,
    count: number
): Promise<void> => {
    try {
        const user = await UserModel.findOne({ twitterId });

        await QuestProgressionModel.updateOne(
            { questId, requirementId, userId: user._id },
            { $inc: { progress: -count } }
        );
    } catch (error) {
        // intentionally ignore the error
    }
};

/**
 * Set the progress of a quest requirement for a specific user.
 * Intentinonally ignore the validation & error catching for speed up the process
 */
export const setProgression = async (
    questId: string,
    requirementId: string,
    twitterId: string,
    count: number
): Promise<void> => {
    try {
        const user = await UserModel.findOne({ twitterId });

        await QuestProgressionModel.updateOne(
            { questId, requirementId, userId: user._id },
            { $set: { progress: count } },
            { upsert: true }
        );
    } catch (error) {
        // intentionally ignore the error
    }
};

/**
 * Increments the progress of all quest requirements of a specific type for a specific user.
 * Intentionally ignore the validation & error catching for speed up the process.
 */
export const incrementProgressionByType = async (
    type: QuestRequirementType,
    twitterId: string,
    count: number,
    params?: string
): Promise<void> => {
    try {
        // Find all quests that have requirements of the specified type
        const quests = await QuestModel.find({ 'requirements.type': type }).lean();

        const user = await UserModel.findOne({ twitterId });

        // Iterate through each quest and update the progression for matching requirements
        for (const quest of quests) {
            if (quest.completedBy.find(({ twitterId }) => twitterId === user.id)) continue;

            // check if the user qualify
            if (quest.unlockable && !quest.qualifiedUsers.includes(user._id)) continue;

            // additional step check for the daily quest
            if (quest.type === QuestType.DAILY) {
                const dailyQuest = await QuestDailyModel.findOne({ user: user._id, quest: quest._id });

                if (!dailyQuest) continue;

                // get current timestamp
                const current = dayjs().unix();

                // check if the daily quest was expired
                if (current >= dailyQuest.expiredAt) continue;

                // check if the user already accepted the quest
                if (!dailyQuest.accepted) continue;
            }

            const requirements = quest.requirements.filter((req) => req.type === type);
            for (const requirement of requirements) {
                if (!requirement.parameters.count) continue;
                if (params && requirement.parameters.type !== params) continue;
                if (typeof requirement.parameters.type != typeof params) continue;
                if (requirement.parameters.type && !requirement.parameters.type.includes(params)) continue;

                // Find the current progression document
                let progression = await QuestProgressionModel.findOne({
                    questId: quest._id,
                    requirementId: requirement._id,
                    userId: user._id,
                });

                if (!progression) {
                    // Create a new progression document if it doesn't exist
                    progression = new QuestProgressionModel({
                        _id: generateObjectId(),
                        questId: quest._id,
                        requirementId: requirement._id,
                        userId: user._id,
                        progress: 0,
                        requirement: requirement.parameters.count ?? 1,
                    });
                }

                // Increment the progress
                progression.progress = Math.min(progression.progress + count, requirement.parameters.count ?? 1);

                // Save the updated progression document
                await progression.save();
            }
        }
    } catch (error) {
        console.log(error);
        // intentionally ignore the error
    }
};

/**
 * Reset and randomize user's daily quest at the POI
 */
export const resetDailyQuest = async (twitterId: string, poi: POIName): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(resetDailyQuest) User not found.`,
            };
        }

        // Initialize currentTimestamp
        const currentTimestamp = dayjs().utc().unix();
        const [prev, next] = DAILY_QUEST_LAPSE_PHASE();

        // delete user's expired daily quests
        await QuestDailyModel.deleteMany({
            user: user._id,
            expiredAt: { $lte: currentTimestamp },
        });
        console.log(`(resetDailyQuest) delete QuestDailyModel with expiredAt <= ${currentTimestamp}`);

        // get user's available daily quest
        const dailyQuests = (
            await QuestDailyModel.find({
                user: user._id,
                expiredAt: { $gt: dayjs().unix() },
            })
                .populate('quest')
                .lean()
        ).map(({ quest }) => quest._id);

        // get list of Quest with Daily type and Berry Factory category
        const quests = await QuestModel.find({
            type: QuestType.DAILY,
            category: QuestCategory.BERRY_FACTORY,
            $or: [{ poi: null }, { poi }],
        });

        // prevent the same quest appear at the same POI by filtering it
        const uniqueQuests = quests.filter(({ _id }) => !dailyQuests.includes(_id));

        // shuffle the quests randomly from uniqueQuests data
        const shuffledQuests = uniqueQuests.sort(() => 0.5 - Math.random()).slice(0, DAILY_QUEST_PER_POI);

        await QuestDailyModel.insertMany(
            shuffledQuests.map((quest) => ({
                _id: generateObjectId(),
                quest: quest._id,
                user: user._id,
                accepted: false,
                claimed: false,
                poi,
                createdAt: prev, // assign createdAt using the previous phase timestamp
                expiredAt: next, // assign expiredAt using the next phase timestamp
                acceptedAt: null,
                claimedAt: null,
            }))
        );

        // delete previous quest progression
        await QuestProgressionModel.deleteMany({
            questId: {  $in: shuffledQuests.map((quest) => quest._id) }
        });

        return {
            status: Status.SUCCESS,
            message: `(resetDailyQuest) Quest updated.`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(resetDailyQuest) ${err.message}`,
        };
    }
};

/**
 * Get user's daily quest based on the POI. each user have it's own unique quests based on the POI
 */
export const getDailyQuests = async (
    twitterId: string,
    poi: POIName
): Promise<ReturnValue<{ quests: QuestDaily[] }>> => {
    try {
        const user = await UserModel.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getDailyQuest) User not found.`,
            };
        }

        // Initialize currentTimestamp
        const currentTimestamp = dayjs().utc().unix();

        // Fetch quests that haven't expired yet and are valid for the current lapse phase
        let quests = await QuestDailyModel.find({
            poi,
            user: user._id,
            expiredAt: { $gt: currentTimestamp }
        }).populate('quest');
        console.log(`(getDailyQuests) available quests length with expiredAt > ${currentTimestamp}: ${quests.length}`);

        // if the quests empty, then reset & randomize the daily quest
        if (!quests || quests.length === 0) {
            await resetDailyQuest(twitterId, poi);
            console.log(`(getDailyQuests) resetting daily quest`);

            // refetch the quests after reset
            quests = await QuestDailyModel.find({
                poi,
                user: user._id,
                expiredAt: { $gte: currentTimestamp },
                createdAt: { $lte: currentTimestamp },
            }).populate('quest');
            console.log(`(getDailyQuests) refetch available quests length: ${quests.length}`);
        }

        // if the quests somehow still empty, even after refetch, then returns error
        if (!quests || quests.length === 0) {
            return {
                status: Status.ERROR,
                message: `(getDailyQuest) Failed to retrieve the daily quests`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getDailyQuest) Quests fetched.`,
            data: {
                quests,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getDailyQuest) ${err.message}`,
        };
    }
};

/**
 * used to accept user's daily quest
 */
export const acceptDailyQuest = async (twitterId: string, questId: number | string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId });
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(acceptDailyQuest) User not found.`,
            };
        }

        const quest = await QuestModel.findOne({ questId });
        if (!quest) {
            return {
                status: Status.ERROR,
                message: `(acceptDailyQuest) Quest not found.`,
            };
        }

        if (!quest.acceptable || quest.type !== QuestType.DAILY) {
            return {
                status: Status.ERROR,
                message: '(acceptDailyQuest) This quest was not acceptable.',
            };
        }

        const [prev, next] = DAILY_QUEST_LAPSE_PHASE();

        const acceptedQuests = await QuestDailyModel.countDocuments({
            user: user._id,
            accepted: true,
            expiredAt: { $gte: prev },
            createdAt: { $lte: next },
        });

        // check if the number of accepted quests exceeds the maximum allowed
        if (acceptedQuests > MAX_DAILY_QUEST_ACCEPTABLE) {
            return {
                status: Status.ERROR,
                message: '(acceptDailyQuest) Maximum daily quests exceeded.',
            };
        }

        const dailyQuest = await QuestDailyModel.findOne({
            user: user._id,
            quest: quest._id,
        });

        // check if the daily quest already accepted
        if (dailyQuest.accepted || dailyQuest.claimed) {
            return {
                status: Status.ERROR,
                message: `(acceptDailyQuest) You've already accepted this quest.`,
            };
        }

        await dailyQuest.updateOne({
            accepted: true,
            acceptedAt: dayjs().unix(),
        });

        return {
            status: Status.SUCCESS,
            message: `(acceptDailyQuest) Quest accepted.`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(acceptDailyQuest) ${err.message}`,
        };
    }
};

/**
 * Get user's accepted daily quest based on the POI
 */
export const getAcceptedQuest = async (twitterId: string): Promise<ReturnValue<{ quests: QuestDaily[] }>> => {
    try {
        const user = await UserModel.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getAcceptedQuest) User not found.`,
            };
        }

        const [prev, next] = DAILY_QUEST_LAPSE_PHASE();

        let quests = await QuestDailyModel.find({
            user: user._id,
            accepted: true,
            expiredAt: { $gte: prev },
            createdAt: { $lte: next },
        })
            .populate('quest')
            .lean();

        const questsWithProgress = (await Promise.all(
            quests.map(async ({ quest, ...rest }) => {
                const requirementsWithProgress = await Promise.all(
                    quest.requirements.map(async (req) => {
                        const progression = await QuestProgressionModel.findOne({
                            questId: quest._id,
                            userId: user._id,
                            requirementId: req._id,
                        }).lean();

                        return {
                            ...req,
                            progress: progression ?? null,
                        };
                    })
                );

                return {
                    ...rest,
                    quest: {
                        ...quest,
                        requirements: requirementsWithProgress,
                    },
                };
            })
        )) as QuestDaily[];

        return {
            status: Status.SUCCESS,
            message: `(getAcceptedQuest) Quests fetched.`,
            data: {
                quests: questsWithProgress,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getAcceptedQuest) ${err.message}`,
        };
    }
};
