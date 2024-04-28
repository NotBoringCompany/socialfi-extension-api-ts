import { BitRarity } from '../models/bit';
import { ObtainMethod } from '../models/obtainMethod';
import { Tutorial, TutorialReward, TutorialRewardType } from '../models/tutorial';
import { ExtendedXCookieData, XCookieSource } from '../models/user';
import { RANDOMIZE_GENDER, getBitStatsModifiersFromTraits, randomizeBitTraits, randomizeBitType } from '../utils/constants/bit';
import { TutorialModel, UserModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';
import { addBitToDatabase, getLatestBitId, randomizeFarmingStats } from './bit';

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
                status: Status.ERROR,
                message: `(completeTutorial) User has already completed tutorial ID ${tutorialId}.`,
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
                    if (bitIdStatus !== Status.SUCCESS) throw new Error(bitIdMessage);

                    // add a premium common bit to the user's inventory (users get 1 for free when they sign up)
                    const {
                        status: bitStatus,
                        message: bitMessage,
                        data: bitData,
                    } = await addBitToDatabase({
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
                    });

                    if (bitStatus !== Status.SUCCESS) throw new Error(bitMessage);

                    userUpdateOperations.$push['inventory.bitIds'] = bitIdData?.latestBitId + 1;

                    tutorial.rewards[i] = {
                        ...tutorial.rewards[i],
                        value: bitData.bit,
                    };

                    break;
            }
        }

        await UserModel.updateOne({ twitterId }, userUpdateOperations);

        return {
            status: Status.SUCCESS,
            message: `(completeTutorial) User has completed tutorial ID ${tutorialId}.`,
            data: { tutorial },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(completeTutorial) Error: ${err.message}`,
        };
    }
};
