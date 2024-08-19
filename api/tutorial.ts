import { Bit, BitRarity } from '../models/bit';
import { IslandType } from '../models/island';
import { Modifier } from '../models/modifier';
import { ObtainMethod } from '../models/obtainMethod';
import { Tutorial, TutorialReward, TutorialRewardType } from '../models/tutorial';
import { ExtendedXCookieData, XCookieSource } from '../models/user';
import { RANDOMIZE_GENDER, getBitStatsModifiersFromTraits, randomizeBitTraits, randomizeBitType } from '../utils/constants/bit';
import { IslandModel, TutorialModel, UserModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';
import { addBitToDatabase, getLatestBitId, randomizeFarmingStats } from './bit';
import { claimCollabReward } from './collab';
import { addIslandToDatabase } from './island';
import { summonIsland } from './terraCapsulator';

/**
 * Adds a tutorial to the database.
 */
export const addTutorial = async (name: string, rewards?: TutorialReward[]): Promise<ReturnValue> => {
    try {
        // get the latest id
        const latestTutorial = await TutorialModel.findOne().sort({ id: -1 });

        // create a new tutorial instance
        const newTutorial = new TutorialModel({
            _id: generateObjectId(),
            id: latestTutorial ? latestTutorial.id + 1 : 1,
            name,
            rewards,
        });

        await newTutorial.save();

        console.log('(addTutorial) Successfully added tutorial with name:', name);

        return {
            status: Status.SUCCESS,
            message: `(addTutorial) Successfully added tutorial with name: ${name}`,
        };
    } catch (err: any) {
        console.log('(addTutorial) Error:', err.message);
        return {
            status: Status.ERROR,
            message: `(addTutorial) Error: ${err.message}`,
        };
    }
};

/**
 * Updates an existing tutorial in the database.
 */
export const updateTutorial = async (tutorialId: number, name?: string, rewards?: TutorialReward[]): Promise<ReturnValue> => {
    try {
        const tutorial = await TutorialModel.findOne({ id: tutorialId });

        if (!tutorial) {
            return {
                status: Status.ERROR,
                message: '(updateTutorial) Tutorial not found.',
            };
        }

        // Update properties if they are provided
        if (name !== undefined) tutorial.name = name;
        if (rewards !== undefined) tutorial.rewards = rewards;

        // Save the updated tutorial
        await tutorial.save();

        return {
            status: Status.SUCCESS,
            message: `(updateTutorial) Successfully updated tutorial with id: ${tutorialId}`,
            data: tutorial,
        };
    } catch (err: any) {
        console.log('(updateTutorial) Error:', err.message);
        return {
            status: Status.ERROR,
            message: `(updateTutorial) Error: ${err.message}`,
        };
    }
};

/**
 * Gets all tutorials from the database.
 */
export const getTutorials = async (): Promise<ReturnValue> => {
    try {
        const tutorials = await TutorialModel.find();

        if (!tutorials || tutorials.length === 0) {
            return {
                status: Status.ERROR,
                message: '(getTutorials) No tutorials found.',
            };
        }

        return {
            status: Status.SUCCESS,
            message: '(getTutorials) Successfully retrieved tutorials',
            data: {
                tutorials: tutorials as Tutorial[],
            },
        };
    } catch (err: any) {
        console.log('(getTutorials) Error:', err.message);
        return {
            status: Status.ERROR,
            message: `(getTutorials) Error: ${err.message}`,
        };
    }
};

/**
 * Gets called when a user completes a specific tutorial.
 */
export const completeTutorial = async (twitterId: string, tutorialId: number): Promise<ReturnValue> => {
    try {
        const tutorial = await TutorialModel.findOne({ id: tutorialId });

        if (!tutorial) {
            return {
                status: Status.ERROR,
                message: `(completeTutorial) Tutorial ID ${tutorialId} not found.`,
            };
        }

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

        // get the user's list of tutorials
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(completeTutorial) User not found.`,
            };
        }

        const userTutorials = user.inGameData.completedTutorialIds as number[];

        // check if the user has already completed this tutorial
        if (userTutorials.includes(tutorialId)) {
            return {
                status: Status.SUCCESS,
                message: `(completeTutorial) User has completed tutorial ID ${tutorialId}.`,
                data: {
                    tutorial,
                },
            };
        }

        // add the tutorial to the user's list of completed tutorials
        userUpdateOperations.$push['inGameData.completedTutorialIds'] = tutorialId;

        for (let i = 0; i < tutorial.rewards.length; i++) {
            const reward: TutorialReward = tutorial.rewards[i];

            switch (reward.type) {
                case TutorialRewardType.X_COOKIES:
                    userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = reward.amount;

                    // check if the user's `xCookieData.extendedXCookieData` contains a source called TUTORIAL_REWARDS.
                    // if yes, we increment the amount, if not, we create a new entry for the source
                    const questRewardsIndex = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(
                        (data) => data.source === XCookieSource.TUTORIAL_REWARDS
                    );

                    if (questRewardsIndex !== -1) {
                        userUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${questRewardsIndex}.xCookies`] = reward.amount;
                    } else {
                        userUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = {
                            xCookies: reward.amount,
                            source: XCookieSource.TUTORIAL_REWARDS,
                        };
                    }
                    break;
                case TutorialRewardType.BIT:
                    const rarity = BitRarity.COMMON;
                    const bitType = randomizeBitType();

                    const traits = randomizeBitTraits(rarity);

                    const bitStatsModifiers = getBitStatsModifiersFromTraits(traits.map((trait) => trait.trait));

                    // get the latest bit ID from the database
                    const { status: bitIdStatus, message: bitIdMessage, data: bitIdData } = await getLatestBitId();
                    if (bitIdStatus !== Status.SUCCESS) {
                        return {
                            status: Status.ERROR,
                            message: `(completeTutorial) Error from getLatestBitId: ${bitIdMessage}`,
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
                        obtainMethod: ObtainMethod.TUTORIAL,
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
                                hasInfluentialTrait ? 'Influential' : hasAntagonisticTrait ? 'Antagonistic' : hasFamousTrait ? 'Famous' : 'Mannerless'
                            }`,
                            value: hasInfluentialTrait ? 1.01 : hasAntagonisticTrait ? 0.99 : hasFamousTrait ? 1.005 : 0.995,
                        };
                        const earningRateModifier: Modifier = {
                            origin: `Bit ID #${newBit.bitId}'s Trait: ${
                                hasInfluentialTrait ? 'Influential' : hasAntagonisticTrait ? 'Antagonistic' : hasFamousTrait ? 'Famous' : 'Mannerless'
                            }`,
                            value: hasInfluentialTrait ? 1.01 : hasAntagonisticTrait ? 0.99 : hasFamousTrait ? 1.005 : 0.995,
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

                    tutorial.rewards[i] = {
                        ...tutorial.rewards[i],
                        value: bitData.bit,
                    };

                    break;
                case TutorialRewardType.ISLAND:
                    const { data: islandData, status } = await summonIsland(IslandType.PRIMAL_ISLES, user._id);
                    if (!islandData || status !== Status.SUCCESS) break;

                    // save the Island to the database
                    const { status: addIslandStatus } = await addIslandToDatabase(islandData.island);

                    if (addIslandStatus !== Status.SUCCESS) break;

                    // add the island ID to the user's inventory
                    userUpdateOperations.$push['inventory.islandIds'] = islandData.island.islandId;

                    tutorial.rewards[i] = {
                        ...tutorial.rewards[i],
                        value: islandData.island,
                    };

                    break;
            }
        }

        // create an array of promises for updating the islands
        const islandUpdatePromises = islandUpdateOperations.map(async (op) => {
            return IslandModel.updateOne({ islandId: op.islandId }, op.updateOperations);
        });

        // execute the update operations
        await Promise.all([await UserModel.updateOne({ twitterId }, userUpdateOperations), ...islandUpdatePromises]);

        // get is tutorial completed status
        const tutorialCount = await TutorialModel.countDocuments();
        const isCompleted = user.inGameData.completedTutorialIds.length + 1 === tutorialCount;

        if (isCompleted) {
            // handle auto-claim collab reward when completed all the tutorials
            await claimCollabReward(user.twitterId);
        }

        return {
            status: Status.SUCCESS,
            message: `(completeTutorial) User has completed tutorial ID ${tutorialId}.`,
            data: {
                tutorial,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(completeTutorial) Error: ${err.message}`,
        };
    }
};

/**
 * Skip all tutorial & rewards
 */
export const skipTutorial = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(skipTutorial) User not found.`,
            };
        }

        const tutorials = await TutorialModel.find().sort({ id: 1 }).lean();

        await UserModel.updateOne(
            { twitterId },
            {
                $set: {
                    'inGameData.completedTutorialIds': tutorials.map(({ id }) => id),
                },
            }
        );

        await claimCollabReward(user.twitterId);

        return {
            status: Status.SUCCESS,
            message: `(skipTutorial) User has skipped the tutorial.`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(skipTutorial) Error: ${err.message}`,
        };
    }
};
