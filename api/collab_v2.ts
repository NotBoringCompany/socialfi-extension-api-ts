import { CollabBasket, CollabParticipant, CollabReward, CollabRewardType } from '../models/collab_v2';
import { Item } from '../models/item';
import { ExtendedXCookieData, XCookieSource } from '../models/user';
import { CollabBasketModel, CollabParticipantModel, UserModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';
import { readSheet } from '../utils/sheet';

/**
 * Adds a participant to the database.
 */
export const addParticipant = async (participant: Partial<CollabParticipant>): Promise<ReturnValue> => {
    try {
        const newParticipant = new CollabParticipantModel({
            _id: generateObjectId(),
            ...participant,
        });

        await newParticipant.save();

        return {
            status: Status.SUCCESS,
            message: `(addParticipant) Participant added.`,
            data: {
                participant: newParticipant,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addParticipant) ${err.message}`,
        };
    }
};

/**
 * Fetches all participants from the database.
 */
export const getAllParticipant = async (): Promise<ReturnValue> => {
    try {
        const participants = await CollabParticipantModel.find().lean();

        if (participants.length === 0) {
            return {
                status: Status.ERROR,
                message: `(getAllParticipant) No participants found.`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getAllParticipant) Participants fetched.`,
            data: {
                participants,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getAllParticipant) ${err.message}`,
        };
    }
};

/**
 * Updates a participant in the database.
 */
export const updateParticipant = async (id: string, data: Partial<CollabParticipant>): Promise<ReturnValue> => {
    try {
        const updatedParticipant = await CollabParticipantModel.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();

        if (!updatedParticipant) {
            return {
                status: Status.ERROR,
                message: `(updateParticipant) Participant not found. Participant ID: ${id}`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(updateParticipant) Participant updated.`,
            data: {
                participant: updatedParticipant,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(updateParticipant) ${err.message}`,
        };
    }
};

/**
 * Deletes a participant from the database.
 */
export const deleteParticipant = async (id: string): Promise<ReturnValue> => {
    try {
        const participant = await CollabParticipantModel.findOne({ _id: id }).lean();

        if (!participant) {
            return {
                status: Status.ERROR,
                message: `(deleteParticipant) Participant not found. Participant ID: ${id}`,
            };
        }

        await CollabParticipantModel.deleteOne({ _id: id });

        return {
            status: Status.SUCCESS,
            message: `(deleteParticipant) Participant deleted.`,
            data: {
                id,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(deleteParticipant) ${err.message}`,
        };
    }
};

/**
 * Adds a basket to the database.
 */
export const addBasket = async (basket: Partial<CollabBasket>): Promise<ReturnValue> => {
    try {
        const newBasket = new CollabBasketModel({
            _id: generateObjectId(),
            ...basket,
        });

        await newBasket.save();

        return {
            status: Status.SUCCESS,
            message: `(addBasket) Basket added.`,
            data: {
                basket: newBasket,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addBasket) ${err.message}`,
        };
    }
};

/**
 * Updates a basket in the database.
 */
export const updateBasket = async (id: string, data: Partial<CollabBasket>): Promise<ReturnValue> => {
    try {
        const updatedBasket = await CollabBasketModel.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();

        if (!updatedBasket) {
            return {
                status: Status.ERROR,
                message: `(updateBasket) Basket not found. Basket ID: ${id}`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(updateBasket) Basket updated.`,
            data: {
                basket: updatedBasket,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(updateBasket) ${err.message}`,
        };
    }
};

/**
 * Deletes a basket from the database.
 */
export const deleteBasket = async (id: string): Promise<ReturnValue> => {
    try {
        const basket = await CollabBasketModel.findOne({ _id: id }).lean();

        if (!basket) {
            return {
                status: Status.ERROR,
                message: `(deleteBasket) Basket not found. Basket ID: ${id}`,
            };
        }

        await CollabBasketModel.deleteOne({ _id: id });

        return {
            status: Status.SUCCESS,
            message: `(deleteBasket) Basket deleted.`,
            data: {
                id,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(deleteBasket) ${err.message}`,
        };
    }
};

/**
 * Import participants using Google Sheet
 */
export const importParticipants = async (spreadsheetId: string, range: string): Promise<ReturnValue> => {
    try {
        const data = (await readSheet(spreadsheetId, range)) as Array<{
            'Community Name': string | null;
            'Discord Name': string | null;
            'Discord ID': string | null;
            'Twitter Handle': string | null;
            Basket: string | null;
        }>;

        // Check if the data is empty
        if (data.length === 0) {
            return {
                status: Status.ERROR,
                message: `(importParticipants) Sheet empty`,
            };
        }

        for (const item of data) {
            let basket = await CollabBasketModel.findOne({ name: item.Basket });

            if (!basket) {
                basket = new CollabBasketModel({
                    _id: generateObjectId(),
                    name: item.Basket,
                    rewards: [],
                });
                await basket.save();
            }

            const existingParticipant = await CollabParticipantModel.findOne({ twitterUsername: item['Twitter Handle'] });

            if (existingParticipant) {
                await CollabParticipantModel.updateOne(
                    { twitterUsername: item['Twitter Handle'] },
                    {
                        $set: {
                            name: item['Discord Name'],
                            discordId: item['Discord ID'],
                            community: item['Community Name'],
                            basket: basket,
                            approved: true,
                            claimable: true,
                        },
                    }
                );
            } else {
                const newParticipant = new CollabParticipantModel({
                    _id: generateObjectId(),
                    name: item['Discord Name'],
                    code: generateObjectId(),
                    role: 'Member',
                    community: item['Community Name'],
                    twitterUsername: item['Twitter Handle'],
                    discordId: item['Discord ID'],
                    basket: basket,
                    claimable: true,
                    approved: true,
                });

                await newParticipant.save();
            }
        }

        const registeredUsers = await UserModel.find({
            twitterUsername: data.map((item) => item['Twitter Handle']),
        }).lean();

        const unregisteredUsers = data.filter((item) => !registeredUsers.find((user) => user.twitterUsername === item['Twitter Handle']));

        // Handle pre-register user
        await UserModel.create(
            unregisteredUsers.map((user) => ({
                _id: generateObjectId(),
                twitterId: null,
                twitterUsername: user['Twitter Handle'],
                inviteCodeData: {
                    usedStarterCode: '',
                    usedReferralCode: null,
                    referrerId: null,
                },
            }))
        );

        return {
            status: Status.SUCCESS,
            message: `(importParticipants) Participants imported`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(importParticipants) ${err.message}`,
        };
    }
};

/**
 * Get collab reward by Twitter ID.
 */
export const getCollabReward = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getCollabReward) User not found.`,
            };
        }

        const participant = await CollabParticipantModel.findOne({ twitterUsername: user.twitterUsername }).populate('basket').lean();
        if (!participant) {
            return {
                status: Status.ERROR,
                message: `(getCollabReward) Participant not found.`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getCollabReward) Collab reward fetched.`,
            data: {
                reward: participant.basket.rewards,
                claimable: participant.claimable,
                approved: participant.approved,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getCollabReward) ${err.message}`,
        };
    }
};

/**
 * Claim collab reward by Twitter ID.
 */
export const claimCollabReward = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimCollabReward) User not found.`,
            };
        }

        const participant = await CollabParticipantModel.findOne({ twitterUsername: user.twitterUsername }).populate('basket');
        if (!participant) {
            return {
                status: Status.ERROR,
                message: `(claimCollabReward) Participant not found.`,
            };
        }

        if (!participant.claimable) {
            return {
                status: Status.ERROR,
                message: `(claimCollabReward) Reward already claimed.`,
            };
        }

        participant.claimable = false;
        await participant.save();

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {},
        };

        const rewards = participant.basket.rewards as CollabReward[];

        for (const reward of rewards) {
            switch (reward.type) {
                case CollabRewardType.BIT_ORB_I:
                case CollabRewardType.BIT_ORB_II:
                case CollabRewardType.BIT_ORB_III:
                case CollabRewardType.TERRA_CAPSULATOR_I:
                case CollabRewardType.TERRA_CAPSULATOR_II:
                    // add the item to the user's inventory
                    const existingItemIndex = (user.inventory?.items as Item[]).findIndex((i) => i.type === (reward.type as any));

                    if (existingItemIndex !== -1) {
                        userUpdateOperations.$inc[`inventory.items.${existingItemIndex}.amount`] = reward.amount;
                    } else {
                        if (!userUpdateOperations.$push['inventory.items']) {
                            userUpdateOperations.$push['inventory.items'] = {
                                $each: [],
                            };
                        }

                        userUpdateOperations.$push['inventory.items'].$each.push({
                            type: reward.type,
                            amount: reward.amount,
                            totalAmountConsumed: 0,
                            weeklyAmountConsumed: 0,
                        });
                    }
                    break;
                case CollabRewardType.X_BIT_BERRY:
                    userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = reward.amount;

                    // check if the user's `xCookieData.extendedXCookieData` contains a source called QUEST_REWARDS.
                    // if yes, we increment the amount, if not, we create a new entry for the source
                    const questRewardsIndex = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(
                        (data) => data.source === XCookieSource.COLLAB_REWARDS
                    );

                    if (questRewardsIndex !== -1) {
                        userUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${questRewardsIndex}.xCookies`] = reward.amount;
                    } else {
                        userUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = {
                            xCookies: reward.amount,
                            source: XCookieSource.COLLAB_REWARDS,
                        };
                    }
                    break;
            }
        }

        await UserModel.updateOne({ twitterId }, { $inc: userUpdateOperations.$inc });
        await UserModel.updateOne({ twitterId }, { $push: userUpdateOperations.$push });

        return {
            status: Status.SUCCESS,
            message: `(claimCollabReward) Reward claimed successfully.`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimCollabReward) ${err.message}`,
        };
    }
};
