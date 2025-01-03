import { DEPLOYER_WALLET, KEYCHAIN_CONTRACT, KOS_CONTRACT, SUPERIOR_KEYCHAIN_CONTRACT, WONDERBITS_CONTRACT, XPROTOCOL_TESTNET_PROVIDER } from '../utils/constants/web3';
import { ReturnValue, Status } from '../utils/retVal';
import { getWallets, updateReferredUsersData } from './user';
import { KOSExplicitOwnership, KOSMetadata, KOSReward, KOSRewardType } from '../models/kos';
import fs from 'fs';
import path from 'path';
import { KOSClaimableDailyRewardsModel, KOSClaimableWeeklyRewardsModel, SquadLeaderboardModel, SquadModel, TEST_CONNECTION, UserModel } from '../utils/constants/db';
import { KOS_DAILY_BENEFITS, KOS_WEEKLY_BENEFITS } from '../utils/constants/kos';
import { ExtendedPointsData, ExtendedXCookieData, InGameData, PointsSource, UserKeyData, UserWallet, XCookieSource } from '../models/user';
import { Item } from '../models/item';
import { BoosterItem } from '../models/booster';
import { generateHashSalt, generateObjectId } from '../utils/crypto';
import mongoose, { ClientSession } from 'mongoose';
import * as dotenv from 'dotenv';
import { BigNumber, ethers } from 'ethers';
import { dayjs } from '../utils/dayjs';
import { CURRENT_SEASON } from '../utils/constants/leaderboard';
import { GET_PLAYER_LEVEL } from '../utils/constants/user';
import { REFERRAL_REQUIRED_LEVEL } from '../utils/constants/invite';
import { addPoints } from './leaderboard';

dotenv.config();

/**
 * Fetches the claimable daily KOS rewards for the user.
 */
export const getClaimableDailyKOSRewards = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getClaimableDailyKOSRewards) User not found.`
            }
        }

        const kosRewardUser = await KOSClaimableDailyRewardsModel.findOne({ userId: user._id });

        if (!kosRewardUser) {
            return {
                status: Status.ERROR,
                message: `(getClaimableDailyKOSRewards) User does not have any claimable daily rewards for KOS benefits.`
            }
        }

        const rewards = kosRewardUser.claimableRewards as KOSReward[];

        return {
            status: Status.SUCCESS,
            message: `(getClaimableDailyKOSRewards) Successfully fetched claimable daily KOS rewards for user ${user.twitterUsername}.`,
            data: {
                rewards
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getClaimableDailyKOSRewards) Error: ${err.message}`
        }
    }
}

/**
 * Fetches the claimable weekly KOS rewards for the user.
 */
export const getClaimableWeeklyKOSRewards = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getClaimableWeeklyKOSRewards) User not found.`
            }
        }

        const kosRewardUser = await KOSClaimableWeeklyRewardsModel.findOne({ userId: user._id });

        if (!kosRewardUser) {
            return {
                status: Status.ERROR,
                message: `(getClaimableWeeklyKOSRewards) User does not have any claimable weekly rewards for KOS benefits.`
            }
        }

        const rewards = kosRewardUser.claimableRewards as KOSReward[];

        return {
            status: Status.SUCCESS,
            message: `(getClaimableWeeklyKOSRewards) Successfully fetched claimable weekly KOS rewards for user ${user.twitterUsername}.`,
            data: {
                rewards
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getClaimableWeeklyKOSRewards) Error: ${err.message}`
        }
    }
}

/**
 * Claims the claimable daily KOS rewards for the user.
 */
export const claimDailyKOSRewards = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimDailyKOSRewards) User not found.`
            }
        }

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const kosRewardUser = await KOSClaimableDailyRewardsModel.findOne({ userId: user._id });

        if (!kosRewardUser) {
            return {
                status: Status.ERROR,
                message: `(claimDailyKOSRewards) User does not have any claimable daily rewards for KOS benefits.`
            }
        }

        // check if the user doesnt have any rewards to claim (i.e. all rewards are 0)
        const rewards = kosRewardUser.claimableRewards as KOSReward[];

        const totalRewards = rewards.reduce((acc, reward) => acc + reward.amount, 0);

        if (totalRewards === 0) {
            return {
                status: Status.ERROR,
                message: `(claimDailyKOSRewards) User does not have any claimable daily rewards for KOS benefits.`
            }
        }

        for (const reward of rewards) {
            switch (reward.type) {
                case KOSRewardType.GATHERING_PROGRESS_BOOSTER_25:
                case KOSRewardType.GATHERING_PROGRESS_BOOSTER_50:
                case KOSRewardType.GATHERING_PROGRESS_BOOSTER_100:
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
                            mintableAmount: 0,
                        });
                    }
                    break;
                case KOSRewardType.X_COOKIES:
                    userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = reward.amount;

                    // check if the user's `xCookieData.extendedXCookieData` contains a source called QUEST_REWARDS.
                    // if yes, we increment the amount, if not, we create a new entry for the source
                    const index = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(
                        (data) => data.source === XCookieSource.KOS_BENEFITS
                    );

                    if (index !== -1) {
                        userUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${index}.xCookies`] = reward.amount;
                    } else {
                        userUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = {
                            xCookies: reward.amount,
                            source: XCookieSource.KOS_BENEFITS,
                        };
                    }
                    break;
            }
        }

        await UserModel.updateOne({ twitterId }, { $inc: userUpdateOperations.$inc });
        await UserModel.updateOne({ twitterId }, { $push: userUpdateOperations.$push });

        // reset all claimable rewards to 0
        await KOSClaimableDailyRewardsModel.updateOne({ userId: user._id }, {
            claimableRewards: []
        });

        console.log(`(claimDailyKOSRewards) Successfully claimed daily KOS rewards for user ${user.twitterUsername}.`);

        return {
            status: Status.SUCCESS,
            message: `(claimDailyKOSRewards) Successfully claimed daily KOS rewards for user ${user.twitterUsername}.`,
            data: {
                rewards: {
                    xCookies: rewards.find(reward => reward.type === KOSRewardType.X_COOKIES)?.amount || 0,
                    gatheringBooster25: rewards.find(reward => reward.type === KOSRewardType.GATHERING_PROGRESS_BOOSTER_25)?.amount || 0,
                    gatheringBooster50: rewards.find(reward => reward.type === KOSRewardType.GATHERING_PROGRESS_BOOSTER_50)?.amount || 0,
                    gatheringBooster100: rewards.find(reward => reward.type === KOSRewardType.GATHERING_PROGRESS_BOOSTER_100)?.amount || 0
                }
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimDailyKOSRewards) Error: ${err.message}`
        }
    }
}

export const claimWeeklyKOSRewards = async (twitterId: string, _session?: ClientSession): Promise<ReturnValue> => {
    const session = _session ?? (await TEST_CONNECTION.startSession());
    if (!_session) session.startTransaction();

    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimWeeklyKOSRewards) User not found.`
            }
        }

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const kosRewardUser = await KOSClaimableWeeklyRewardsModel.findOne({ userId: user._id });

        if (!kosRewardUser) {
            return {
                status: Status.ERROR,
                message: `(claimWeeklyKOSRewards) User does not have any claimable weekly rewards for KOS benefits.`
            }
        }

        // check if the user doesnt have any rewards to claim (i.e. all rewards are 0)
        const rewards = kosRewardUser.claimableRewards as KOSReward[];

        const totalRewards = rewards.reduce((acc, reward) => acc + reward.amount, 0);

        if (totalRewards === 0) {
            return {
                status: Status.ERROR,
                message: `(claimWeeklyKOSRewards) User does not have any claimable weekly rewards for KOS benefits.`
            }
        }

        // filter out rewards with the amount of 0 and map the remaining to add the rewards to the user's account
        rewards.filter(reward => reward.amount > 0).map(async reward => {
            if (reward.type === KOSRewardType.LEADERBOARD_POINTS) {
                const result =  await addPoints(user._id, { source: PointsSource.KOS_BENEFITS, points: reward.amount });
                if (result.status !== Status.SUCCESS) {
                    throw new Error(result.message);
                }

                // if reward is bit orb I or II
            } else if (reward.type === KOSRewardType.BIT_ORB_I || reward.type === KOSRewardType.BIT_ORB_II) {
                // check if the user's `inventory.items` contain the bit orb type
                // if not, create a new entry, else increment the amount.
                const bitOrbIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === reward.type as string);

                if (bitOrbIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.items.${bitOrbIndex}.amount`] = reward.amount;
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
                        mintableAmount: 0,
                    });
                }
                // if reward is terra capsulator I or II
            } else if (reward.type === KOSRewardType.TERRA_CAPSULATOR_I || reward.type === KOSRewardType.TERRA_CAPSULATOR_II) {
                // check if the user's `inventory.items` contain the terra capsulator type
                // if not, create a new entry, else increment the amount.
                const terraCapsulatorIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === reward.type as string);

                if (terraCapsulatorIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.items.${terraCapsulatorIndex}.amount`] = reward.amount;
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
                        mintableAmount: 0,
                    });
                }
                // if reward type is raft speed booster 60 min
            } else if (reward.type === KOSRewardType.RAFT_SPEED_BOOSTER_60_MIN) {
                // check if the user's `inventory.items` contain the raft speed booster type
                // if not, create a new entry, else increment the amount.
                const raftSpeedBoosterIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === reward.type as string);

                if (raftSpeedBoosterIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.items.${raftSpeedBoosterIndex}.amount`] = reward.amount;
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
                        mintableAmount: 0,
                    });
                }
                // if reward type is xCookies
            } else if (reward.type === KOSRewardType.X_COOKIES) {
                // increase the user's xCookies
                userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = reward.amount;

                // check if the user's `extendedXCookieData` already has a source called KOS_BENEFITS.
                // if not, create a new entry, else increment the amount.
                const kosBenefitsIndex = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(data => data.source === XCookieSource.KOS_BENEFITS);

                if (kosBenefitsIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${kosBenefitsIndex}.xCookies`] = reward.amount;
                } else {
                    userUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = {
                        xCookies: reward.amount,
                        source: XCookieSource.KOS_BENEFITS
                    }
                }
            }
        });

        // execute the update operations. $set and $inc first, then $push and $pull to avoid conflicts.
        await Promise.all([
            await UserModel.updateOne({ twitterId }, { $set: userUpdateOperations.$set, $inc: userUpdateOperations.$inc }, { session }),
        ]);

        await Promise.all([
            await UserModel.updateOne({ twitterId }, { $push: userUpdateOperations.$push, $pull: userUpdateOperations.$pull }, { session }),
        ]);

        // reset all claimable rewards to 0
        await KOSClaimableWeeklyRewardsModel.updateOne({ userId: user._id }, {
            claimableRewards: []
        }, { session });

        console.log(`(claimWeeklyKOSRewards) Successfully claimed weekly KOS rewards for user ${user.twitterUsername}.`);

        // commit the transaction only if this function started it
        if (!_session) {
            await session.commitTransaction();
        }

        return {
            status: Status.SUCCESS,
            message: `(claimWeeklyKOSRewards) Successfully claimed weekly KOS rewards for user ${user.twitterUsername}.`,
            data: {
                rewards: {
                    leaderboardPoints: rewards.find(reward => reward.type === KOSRewardType.LEADERBOARD_POINTS)?.amount || 0,
                    bitOrbI: rewards.find(reward => reward.type === KOSRewardType.BIT_ORB_I)?.amount || 0,
                    bitOrbII: rewards.find(reward => reward.type === KOSRewardType.BIT_ORB_II)?.amount || 0,
                    terraCapsulatorI: rewards.find(reward => reward.type === KOSRewardType.TERRA_CAPSULATOR_I)?.amount || 0,
                    terraCapsulatorII: rewards.find(reward => reward.type === KOSRewardType.TERRA_CAPSULATOR_II)?.amount || 0,
                    raftSpeedBooster60Min: rewards.find(reward => reward.type === KOSRewardType.RAFT_SPEED_BOOSTER_60_MIN)?.amount || 0
                },
            }
        }
    } catch (err: any) {
        // abort the transaction if an error occurs
        if (!_session) {
            await session.abortTransaction();
        }

        console.log('error from claimWeeklyKOSRewards: ', err);
        return {
            status: Status.ERROR,
            message: `(claimWeeklyKOSRewards) Error: ${err.message}`
        }
    } finally {
        if (!_session) {
            session.endSession();
        }
    }
}

/**
 * Checks, for each user who owns at least 1 Key of Salvation, if they have owned each key for at least 1 day (from 23:59 UTC the previous day to 23:59 UTC now).
 * If they have, they will be eligible to earn the daily KOS rewards based on the amount of keys that match that 1-day criteria.
 * 
 * The rewards will be sent to the `KOSClaimableDailyRewards` collection.
 * Called by a scheduler every day at 23:59 UTC.
 */
export const checkDailyKOSRewards = async (): Promise<void> => {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);

        const errors: string[] = [];
        const users = await UserModel.find({ twitterId: { $ne: null, $exists: true } });

        if (!users || users.length === 0) {
            console.error(`(checkDailyKOSOwnership) No users found.`);
            return;
        }

        // fetch the metadata file
        const metadataFile = fetchKOSMetadataFile();

        // get explicit ownerships of keys
        // create an array for ID 1 to 5000 (since that's all the IDs for the keys)
        const keyIds = Array.from({ length: 5000 }, (_, i) => i + 1);
        const { status: ownershipStatus, message: ownershipMessage, data: ownershipData } = await explicitOwnershipsOfKOS(keyIds);

        if (ownershipStatus !== Status.SUCCESS) {
            console.error(`(checkDailyKOSOwnership) Error: ${ownershipMessage}`);
            return;
        }

        const { keyOwnerships } = ownershipData;

        const bulkWriteOpsPromises = users.map(async (user) => {
            const updateOperations = [];

            // get all of the user's wallet addresses (main wallet + secondary wallets)
            const { status: walletStatus, message: walletMessage, data: walletData } = await getWallets(user.twitterId);

            if (walletStatus !== Status.SUCCESS) {
                // if wallet can't be fetched, then skip this user; add it to the errors list.
                errors.push(walletMessage + `User: ${user.twitterId}`);
                // continue to the next user.
                return [];
            }

            // filter for empty string and convert all to lower case
            const validAddresses = (walletData.walletAddresses as string[]).filter((address: string) => address !== '').map((address: string) => address.toLowerCase());
            if (validAddresses.length === 0 || validAddresses === null || validAddresses === undefined) {
                // if no valid addresses, skip this user; add to errors.
                errors.push(`No valid addresses found for user: ${user.twitterId}`);
                return [];
            }

            // get user's owned keys
            const ownedKeys: KOSExplicitOwnership[] = [];

            for (const keyOwnership of keyOwnerships) {
                if (validAddresses.includes(keyOwnership.owner.toLowerCase())) {
                    ownedKeys.push(keyOwnership);
                }
            }

            // get the total keys owned by the user for at least 1 day
            const validKeys = ownedKeys.filter((ownership) => ownership.startTimestamp <= Math.floor(Date.now() / 1000) - 86400);

            // get the metadata for each of the valid keys
            const validKeysMetadata: KOSMetadata[] = validKeys.map((key) => {
                return metadataFile.find((metadata) => metadata.keyId === key.tokenId) as KOSMetadata;
            });

            // get the eligible daily rewards
            const { xCookies, gatheringBooster25, gatheringBooster50, gatheringBooster100 } = KOS_DAILY_BENEFITS(validKeysMetadata);

            // check if the user exists in the `KOSClaimableDailyRewards` collection.
            // if it doesn't, add a new entry. else, update the entry.
            const kosRewardUser = await KOSClaimableDailyRewardsModel.findOne({ userId: user._id });

            // if the user isn't found, we will create a new entry and directly add the rewards and update the database.
            // if found, we will add it to `updateOperations` and update the database later.
            if (!kosRewardUser) {
                console.log('new user found. adding user to KOSClaimableDailyRewards.');

                const newKOSRewardUser = new KOSClaimableDailyRewardsModel({
                    _id: generateObjectId(),
                    userId: user._id,
                    username: user.twitterUsername,
                    twitterProfilePicture: user.twitterProfilePicture,
                    // add each reward
                    claimableRewards: [
                        {
                            type: KOSRewardType.X_COOKIES,
                            amount: xCookies
                        },
                        {
                            type: KOSRewardType.GATHERING_PROGRESS_BOOSTER_25,
                            amount: gatheringBooster25
                        },
                        {
                            type: KOSRewardType.GATHERING_PROGRESS_BOOSTER_50,
                            amount: gatheringBooster50
                        },
                        {
                            type: KOSRewardType.GATHERING_PROGRESS_BOOSTER_100,
                            amount: gatheringBooster100
                        }
                    ]
                });

                await newKOSRewardUser.save();

                console.log(`new user found. adding user ${user.twitterUsername} to KOSClaimableDailyRewards.`);

                return [];
            } else {
                console.log('existing user found. updating user in KOSClaimableDailyRewards.');

                // if user is found, we will increment the amounts for xCookies, gatheringBooster25, gatheringBooster50, gatheringBooster100.
                // and add it to `updateOperations` to update the database later.
                const xCookiesIndex = (kosRewardUser.claimableRewards as KOSReward[]).findIndex(reward => reward.type === KOSRewardType.X_COOKIES);
                const gatheringBooster25Index = (kosRewardUser.claimableRewards as KOSReward[]).findIndex(reward => reward.type === KOSRewardType.GATHERING_PROGRESS_BOOSTER_25);
                const gatheringBooster50Index = (kosRewardUser.claimableRewards as KOSReward[]).findIndex(reward => reward.type === KOSRewardType.GATHERING_PROGRESS_BOOSTER_50);
                const gatheringBooster100Index = (kosRewardUser.claimableRewards as KOSReward[]).findIndex(reward => reward.type === KOSRewardType.GATHERING_PROGRESS_BOOSTER_100);

                if (xCookiesIndex !== -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $inc: {
                                    [`claimableRewards.${xCookiesIndex}.amount`]: xCookies
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $push: {
                                    'claimableRewards': {
                                        type: KOSRewardType.X_COOKIES,
                                        amount: xCookies
                                    }
                                }
                            }
                        }
                    });
                }

                if (gatheringBooster25Index !== -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $inc: {
                                    [`claimableRewards.${gatheringBooster25Index}.amount`]: gatheringBooster25
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $push: {
                                    'claimableRewards': {
                                        type: KOSRewardType.GATHERING_PROGRESS_BOOSTER_25,
                                        amount: gatheringBooster25
                                    }
                                }
                            }
                        }
                    });
                }

                if (gatheringBooster50Index !== -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $inc: {
                                    [`claimableRewards.${gatheringBooster50Index}.amount`]: gatheringBooster50
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $push: {
                                    'claimableRewards': {
                                        type: KOSRewardType.GATHERING_PROGRESS_BOOSTER_50,
                                        amount: gatheringBooster50
                                    }
                                }
                            }
                        }
                    });
                }

                if (gatheringBooster100Index !== -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $inc: {
                                    [`claimableRewards.${gatheringBooster100Index}.amount`]: gatheringBooster100
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $push: {
                                    'claimableRewards': {
                                        type: KOSRewardType.GATHERING_PROGRESS_BOOSTER_100,
                                        amount: gatheringBooster100
                                    }
                                }
                            }
                        }
                    });
                }
            }

            return updateOperations;
        });

        const bulkWriteOpsArrays = await Promise.all(bulkWriteOpsPromises);

        const bulkWriteOps = bulkWriteOpsArrays.flat().filter(op => op !== undefined);

        if (bulkWriteOps.length === 0) {
            console.log(`(checkDailyKOSOwnership) No existing users were eligible to update their daily KOS rewards.`);
            return;
        }

        // execute the bulk write operations
        await KOSClaimableDailyRewardsModel.bulkWrite(bulkWriteOps);

        if (errors.length > 0) {
            console.error(`(checkDailyKOSOwnership) Errors: ${errors.join('\n')}`);
        }

        console.log(`(checkDailyKOSOwnership) Successfully updated claimable daily KOS rewards.`);
    } catch (err: any) {
        console.error(`(checkDailyKOSOwnership) Error: ${err.message}`);
    }
}

/**
 * Checks, for each user who owns at least 1 Key of Salvation, Keychain and/or Superior Keychain, if they have owned each key/keychain/superior keychain for at least 7 days (from 23:59 UTC 7 days ago to 23:59 UTC now).
 * 
 * If they have, and if the NFTs match certain required attributes/traits, they will be eligible to earn the weekly KOS rewards based on the amount of keys that match that 7-day criteria.
 * 
 * The rewards will then be distributed to the `KOSClaimableWeeklyRewards` collection.
 * 
 * Called by a scheduler every Sunday at 23:59 UTC.
 */
export const checkWeeklyKOSRewards = async (): Promise<void> => {
    try {
        const users = await UserModel.find({ twitterId: { $ne: null, $exists: true } });

        if (!users || users.length === 0) {
            console.error(`(checkWeeklyKOSRewards) No users found.`);
            return;
        }

        const errors: string[] = [];

        // fetch the metadata file
        const metadataFile = fetchKOSMetadataFile();

        // fetch all explicit ownerships of keys, keychains and superior keychains
        const { status: ownershipStatus, message: ownershipMessage, data: ownershipData } = await getAllExplicitOwnerships();

        if (ownershipStatus !== Status.SUCCESS) {
            console.error(`(checkWeeklyKOSRewards) Error: ${ownershipMessage}`);
            return;
        }

        const { keyOwnerships, keychainOwnerships, superiorKeychainOwnerships } = ownershipData;

        const bulkWriteOpsPromises = users.map(async user => {
            const updateOperations = [];

            // get all of the user's wallet addresses (main wallet + secondary wallets)
            const { status: walletStatus, message: walletMessage, data: walletData } = await getWallets(user.twitterId);

            if (walletStatus !== Status.SUCCESS) {
                // if wallet can't be fetched, then skip this user; add it to the errors list.
                errors.push(walletMessage + `User: ${user.twitterId}`);
                // continue to the next user.
                return [];
            }

            // filter for empty string and convert all to lower case
            const validAddresses = (walletData.walletAddresses as string[]).filter((address: string) => address !== '').map((address: string) => address.toLowerCase());
            if (validAddresses.length === 0 || validAddresses === null || validAddresses === undefined) {
                // if no valid addresses, skip this user; add to errors.
                errors.push(`No valid addresses found for user: ${user.twitterId}`);
                return [];
            }

            // check if the user has any keys, keychains or superior keychains
            // to do this, the key, keychain and superior keychain ownerships are looped through and checked if `owner` matches any of the user's addresses.
            const ownedKeys: KOSExplicitOwnership[] = [];
            const ownedKeychains: KOSExplicitOwnership[] = [];
            const ownedSuperiorKeychains: KOSExplicitOwnership[] = [];

            for (const keyOwnership of keyOwnerships) {
                if (validAddresses.includes(keyOwnership.owner.toLowerCase())) {
                    ownedKeys.push(keyOwnership);
                }
            }

            for (const keychainOwnership of keychainOwnerships) {
                if (validAddresses.includes(keychainOwnership.owner.toLowerCase())) {
                    ownedKeychains.push(keychainOwnership);
                }
            }

            for (const superiorKeychainOwnership of superiorKeychainOwnerships) {
                if (validAddresses.includes(superiorKeychainOwnership.owner.toLowerCase())) {
                    ownedSuperiorKeychains.push(superiorKeychainOwnership);
                }
            }

            // get the total keys owned by the user for at least 7 days
            const validKeys = ownedKeys.filter(ownership => ownership.startTimestamp <= Math.floor(Date.now() / 1000) - 604800);
            // get the total keychains owned by the user for at least 7 days
            const validKeychains = ownedKeychains.filter(ownership => ownership.startTimestamp <= Math.floor(Date.now() / 1000) - 604800);
            // get the total superior keychains owned by the user for at least 7 days
            const validSuperiorKeychains = ownedSuperiorKeychains.filter(ownership => ownership.startTimestamp <= Math.floor(Date.now() / 1000) - 604800);

            // get the metadata for each valid key
            const validKeysMetadata: KOSMetadata[] = validKeys.map(key => {
                return metadataFile.find(metadata => metadata.keyId === key.tokenId) as KOSMetadata;
            });

            // get the eligible weekly rewards
            const { points, xCookies, bitOrbI, bitOrbII, terraCapI, terraCapII, raftBooster60 } = KOS_WEEKLY_BENEFITS(
                validKeysMetadata,
                validKeychains.length,
                validSuperiorKeychains.length
            );

            // check if the user exists in the `KOSClaimableWeeklyRewards` collection.
            // if it doesn't, add a new entry. else, update the entry.
            const kosRewardUser = await KOSClaimableWeeklyRewardsModel.findOne({ userId: user._id });

            // if the user isn't found, we will create a new entry and directly add the rewards and update the database.
            // if found, we will add it to `updateOperations` and update the database later.
            if (!kosRewardUser) {
                const newKOSRewardUser = new KOSClaimableWeeklyRewardsModel({
                    _id: generateObjectId(),
                    userId: user._id,
                    username: user.twitterUsername,
                    twitterProfilePicture: user.twitterProfilePicture,
                    // add each reward
                    claimableRewards: [
                        {
                            type: KOSRewardType.LEADERBOARD_POINTS,
                            amount: points
                        },
                        {
                            type: KOSRewardType.BIT_ORB_I,
                            amount: bitOrbI
                        },
                        {
                            type: KOSRewardType.BIT_ORB_II,
                            amount: bitOrbII
                        },
                        {
                            type: KOSRewardType.TERRA_CAPSULATOR_I,
                            amount: terraCapI
                        },
                        {
                            type: KOSRewardType.TERRA_CAPSULATOR_II,
                            amount: terraCapII
                        },
                        {
                            type: KOSRewardType.RAFT_SPEED_BOOSTER_60_MIN,
                            amount: raftBooster60
                        }
                    ]
                });

                console.log('new kos reward: ', newKOSRewardUser);

                await newKOSRewardUser.save();

                console.log(`new user found. adding user ${user.twitterUsername} to KOSClaimableWeeklyRewards.`);

                return [];
            } else {
                // if user is found, we will increment the amounts for each reward.
                // and add it to `updateOperations` to update the database later.
                const pointsIndex = (kosRewardUser.claimableRewards as KOSReward[]).findIndex(reward => reward.type === KOSRewardType.LEADERBOARD_POINTS);
                const xCookiesIndex = (kosRewardUser.claimableRewards as KOSReward[]).findIndex(reward => reward.type === KOSRewardType.X_COOKIES);
                const bitOrbIIndex = (kosRewardUser.claimableRewards as KOSReward[]).findIndex(reward => reward.type === KOSRewardType.BIT_ORB_I);
                const bitOrbIIIndex = (kosRewardUser.claimableRewards as KOSReward[]).findIndex(reward => reward.type === KOSRewardType.BIT_ORB_II);
                const terraCapIIndex = (kosRewardUser.claimableRewards as KOSReward[]).findIndex(reward => reward.type === KOSRewardType.TERRA_CAPSULATOR_I);
                const terraCapIIIndex = (kosRewardUser.claimableRewards as KOSReward[]).findIndex(reward => reward.type === KOSRewardType.TERRA_CAPSULATOR_II);
                const raftBooster60Index = (kosRewardUser.claimableRewards as KOSReward[]).findIndex(reward => reward.type === KOSRewardType.RAFT_SPEED_BOOSTER_60_MIN);

                if (pointsIndex !== -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $inc: {
                                    [`claimableRewards.${pointsIndex}.amount`]: points
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $push: {
                                    'claimableRewards': {
                                        type: KOSRewardType.LEADERBOARD_POINTS,
                                        amount: points
                                    }
                                }
                            }
                        }
                    });
                }

                if (xCookiesIndex !== -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $inc: {
                                    [`claimableRewards.${xCookiesIndex}.amount`]: xCookies
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $push: {
                                    'claimableRewards': {
                                        type: KOSRewardType.X_COOKIES,
                                        amount: xCookies
                                    }
                                }
                            }
                        }
                    });
                }

                if (bitOrbIIndex !== -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $inc: {
                                    [`claimableRewards.${bitOrbIIndex}.amount`]: bitOrbI
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $push: {
                                    'claimableRewards': {
                                        type: KOSRewardType.BIT_ORB_I,
                                        amount: bitOrbI
                                    }
                                }
                            }
                        }
                    });
                }

                if (bitOrbIIIndex !== -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $inc: {
                                    [`claimableRewards.${bitOrbIIIndex}.amount`]: bitOrbII
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $push: {
                                    'claimableRewards': {
                                        type: KOSRewardType.BIT_ORB_II,
                                        amount: bitOrbII
                                    }
                                }
                            }
                        }
                    });
                }

                if (terraCapIIndex !== -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $inc: {
                                    [`claimableRewards.${terraCapIIndex}.amount`]: terraCapI
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $push: {
                                    'claimableRewards': {
                                        type: KOSRewardType.TERRA_CAPSULATOR_I,
                                        amount: terraCapI
                                    }
                                }
                            }
                        }
                    });
                }

                if (terraCapIIIndex !== -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $inc: {
                                    [`claimableRewards.${terraCapIIIndex}.amount`]: terraCapII
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $push: {
                                    'claimableRewards': {
                                        type: KOSRewardType.TERRA_CAPSULATOR_II,
                                        amount: terraCapII
                                    }
                                }
                            }
                        }
                    });
                }

                if (raftBooster60Index !== -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $inc: {
                                    [`claimableRewards.${raftBooster60Index}.amount`]: raftBooster60
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { userId: user._id },
                            update: {
                                $push: {
                                    'claimableRewards': {
                                        type: KOSRewardType.RAFT_SPEED_BOOSTER_60_MIN,
                                        amount: raftBooster60
                                    }
                                }
                            }
                        }
                    });
                }
            }

            return updateOperations;
        });

        const bulkWriteOpsArrays = await Promise.all(bulkWriteOpsPromises);

        const bulkWriteOps = bulkWriteOpsArrays.flat().filter(op => op !== undefined);

        if (bulkWriteOps.length === 0) {
            console.log(`(checkWeeklyKOSOwnership) No existing users were eligible to update their weekly KOS rewards.`);
            return;
        }

        // execute the bulk write operations
        await KOSClaimableWeeklyRewardsModel.bulkWrite(bulkWriteOps);

        if (errors.length > 0) {
            console.error(`(checkWeeklyKOSOwnership) Errors: ${errors.join('\n')}`);
        }

        console.log(`(checkWeeklyKOSOwnership) Successfully updated claimable weekly KOS rewards.`);
    } catch (err: any) {
        console.log('error from checkWeeklyKOSOwnership: ', err.message);
    }
}

/**
 * Gets the `explicitOwnershipsOf` data for all KOS, Keychains and Superior Keychains.
 * 
 * This is a more effective method than to fetch the IDs manually per address due to rate limiting issues with the node endpoint.
 */
export const getAllExplicitOwnerships = async (): Promise<ReturnValue> => {
    try {
        // there is a limited supply of 5,000 for KOS. hence, we can just create an array for IDs from 1 to 5000.
        const keyIds = Array.from({ length: 5000 }, (_, i) => i + 1);
        // keychain collection has a limited supply of 800, so we can just create an array from 1 to 800
        const keychainIds = Array.from({ length: 800 }, (_, i) => i + 1);
        // sup keychain has a limited supply of 135, so we can just create an array from 1 to 135.
        const supKeychainIds = Array.from({ length: 135 }, (_, i) => i + 1);

        const keyOwnerships = await KOS_CONTRACT.explicitOwnershipsOf(keyIds);
        const keychainOwnerships = await KEYCHAIN_CONTRACT.explicitOwnershipsOf(keychainIds);
        const supKeychainOwnerships = await SUPERIOR_KEYCHAIN_CONTRACT.explicitOwnershipsOf(supKeychainIds);

        const formattedKeyOwnerships: KOSExplicitOwnership[] = keyOwnerships.map((ownership: any, index: number) => {
            return {
                // get the key ID
                tokenId: keyIds[index],
                owner: ownership.addr,
                // convert startTimestamp to unix
                startTimestamp: ownership.startTimestamp.toNumber(),
                burned: ownership.burned,
                extraData: ownership.extraData
            }
        });

        // we can use the KOSExplicitOwnership interface here because the struct is the same for both Key of Salvation and Keychain
        const formattedKeychainOwnerships: KOSExplicitOwnership[] = keychainOwnerships.map((ownership: any, index: number) => {
            return {
                // get the keychain ID
                tokenId: keychainIds[index],
                owner: ownership.addr,
                // convert startTimestamp to unix
                startTimestamp: ownership.startTimestamp.toNumber(),
                burned: ownership.burned,
                extraData: ownership.extraData
            }
        })

        // we can use the KOSExplicitOwnership interface here because the struct is the same for both Key of Salvation and Keychain
        const formattedSupKeychainOwnerships: KOSExplicitOwnership[] = supKeychainOwnerships.map((ownership: any, index: number) => {
            return {
                // get the superior keychain ID
                tokenId: supKeychainIds[index],
                owner: ownership.addr,
                // convert startTimestamp to unix
                startTimestamp: ownership.startTimestamp.toNumber(),
                burned: ownership.burned,
                extraData: ownership.extraData
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(getKOSAndKeychainOwnerships) Successfully retrieved explicit ownerships of KOS, Keychains and Superior Keychains.`,
            data: {
                keyOwnerships: formattedKeyOwnerships,
                keychainOwnerships: formattedKeychainOwnerships,
                superiorKeychainOwnerships: formattedSupKeychainOwnerships
            }
        }
    } catch (err: any) {
        console.log('error from getKOSAndKeychainOwnerships: ', err.message);
        return {
            status: Status.ERROR,
            message: `(getKOSAndKeychainOwnerships) Error: ${err.message}`
        }
    }
}

/**
 * Gets all Key of Salvation IDs owned by the user (main + secondary wallets).
 */
export const getOwnedKeyIDs = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId });

        const keyData = (user.inGameData as InGameData).keyData

        // check if the keydata exist and the last check haven't past 24 hours yet, then return the values from the cache instead
        if (keyData && !dayjs.unix(keyData.lastCheckTimestamp).isAfter(dayjs().subtract(24, 'hour'))) {
            return {
                status: Status.SUCCESS,
                message: `(getOwnedKeys) Successfully retrieved owned Key of Salvation IDs.`,
                data: {
                    ownedKeyCount: keyData.ownedKeyCount,
                    ownedKeyIDs: keyData.ownedKeyIDs
                }
            };
        }

        const { status, message, data } = await getWallets(twitterId);

        if (status !== Status.SUCCESS) {
            console.log('error from wallet fetching from getOwnedKeyIDs: ', message);
            return {
                status,
                message: `(getOwnedKeys) Error from getWallets: ${message}`
            };
        }

        // check if wallet addresses have empty strings. filter these out.
        const validAddresses = data.walletAddresses.filter((address: string) => address !== '');

        if (validAddresses.length === 0 || validAddresses === null || validAddresses === undefined) {
            return {
                status: Status.SUCCESS,
                message: `(getOwnedKeys) No owned Key of Salvation IDs found.`,
                data: {
                    ownedKeyCount: 0,
                    ownedKeyIDs: []
                }
            };
        }

        // Create an array of requests to call `tokensOfOwner` in the contract
        const requests: Promise<BigNumber[]>[] = validAddresses.map((walletAddress: string) =>
            KOS_CONTRACT.tokensOfOwner(walletAddress)
        );

        // Execute all the requests
        const keyIDsArray = await Promise.all(requests);

        const keyIDs = keyIDsArray.flat()
            .filter((id: BigNumber) => id !== null && id !== undefined)
            .map((id: BigNumber) => {
                try {
                    return id.toNumber();
                } catch (err: any) {
                    console.log('error from getOwnedKeyIDs when mapping from big number: ', err.message);
                    return id.toString(); // Fallback to string if too large
                }
            });

        // save the values as a cache
        await user.updateOne({
            $set: {
                'inGameData.keyData': {
                    lastCheckTimestamp: dayjs().unix(),
                    ownedKeyCount: keyIDs.length,
                    ownedKeyIDs: keyIDs
                } as UserKeyData
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(getOwnedKeys) Successfully retrieved owned Key of Salvation IDs.`,
            data: {
                ownedKeyCount: keyIDs.length,
                ownedKeyIDs: keyIDs
            }
        };
    } catch (err: any) {
        console.log('error from getOwnedKeyIDs: ', err.message);
        return {
            status: Status.ERROR,
            message: `(getOwnedKeys) Error: ${err.message}`
        };
    }
}

/**
 * Gets all Keychain IDs owned by the user (main + secondary wallets).
 */
export const getOwnedKeychainIDs = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const { status, message, data } = await getWallets(twitterId);

        if (status !== Status.SUCCESS) {
            console.log('error from wallet fetching from getOwnedKeychainIDs: ', message);
            return {
                status,
                message: `(getOwnedKeychainIDs) Error from getWallets: ${message}`
            };
        }

        // check if wallet addresses have empty strings. filter these out.
        const validAddresses = data.walletAddresses.filter((address: string) => address !== '');

        if (validAddresses.length === 0 || validAddresses === null || validAddresses === undefined) {
            return {
                status: Status.SUCCESS,
                message: `(getOwnedKeys) No owned Key of Salvation IDs found.`,
                data: {
                    ownedKeychainCount: 0,
                    ownedKeyIDs: []
                }
            };
        }

        // Create an array of requests to call `tokensOfOwner` in the contract
        const requests: Promise<BigNumber[]>[] = validAddresses.map((walletAddress: string) =>
            KEYCHAIN_CONTRACT.tokensOfOwner(walletAddress)
        );

        // Execute all the requests
        const keychainIDsArray = await Promise.all(requests);

        const keychainIDs = keychainIDsArray.flat()
            .filter((id: BigNumber) => id !== null && id !== undefined)
            .map((id: BigNumber) => {
                try {
                    return id.toNumber();
                } catch (err: any) {
                    console.log('error from getOwnedKeychainIDs when mapping from big number: ', err.message);
                    return id.toString(); // Fallback to string if too large
                }
            });

        return {
            status: Status.SUCCESS,
            message: `(getOwnedKeychainIDs) Successfully retrieved owned Keychain IDs.`,
            data: {
                ownedKeychainCount: keychainIDs.length,
                ownedKeychainIDs: keychainIDs
            }
        };
    } catch (err: any) {
        console.log('error from getOwnedKeychainIDs: ', err.message);
        return {
            status: Status.ERROR,
            message: `(getOwnedKeychainIDs) Error: ${err.message}`
        };
    }
}

/**
 * Gets all Superior Keychain IDs owned by the user (main + secondary wallets).
 */
export const getOwnedSuperiorKeychainIDs = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const { status, message, data } = await getWallets(twitterId);

        if (status !== Status.SUCCESS) {
            console.log('error from wallet fetching from getOwnedSuperiorKeychainIDs: ', message);
            return {
                status,
                message: `(getOwnedSuperiorKeychainIDs) Error from getWallets: ${message}`
            };
        }

        // check if wallet addresses have empty strings. filter these out.
        const validAddresses = data.walletAddresses.filter((address: string) => address !== '');

        if (validAddresses.length === 0 || validAddresses === null || validAddresses === undefined) {
            return {
                status: Status.SUCCESS,
                message: `(getOwnedKeys) No owned Key of Salvation IDs found.`,
                data: {
                    ownedSuperiorKeychainCount: 0,
                    ownedSuperiorKeychainIDs: []
                }
            };
        }

        // Create an array of requests to call `tokensOfOwner` in the contract
        const requests: Promise<BigNumber[]>[] = validAddresses.map((walletAddress: string) =>
            SUPERIOR_KEYCHAIN_CONTRACT.tokensOfOwner(walletAddress)
        );

        // Execute all the requests
        const superiorKeychainIDsArray = await Promise.all(requests);

        const superiorKeychainIDs = superiorKeychainIDsArray.flat()
            .filter((id: BigNumber) => id !== null && id !== undefined)
            .map((id: BigNumber) => {
                try {
                    return id.toNumber();
                } catch (err: any) {
                    console.log('error from getOwnedSuperiorKeychainIDs when mapping from big number: ', err.message);
                    return id.toString(); // Fallback to string if too large
                }
            });

        return {
            status: Status.SUCCESS,
            message: `(getOwnedSuperiorKeychainIDs) Successfully retrieved owned Superior Keychain IDs.`,
            data: {
                ownedSuperiorKeychainCount: superiorKeychainIDs.length,
                ownedSuperiorKeychainIDs: superiorKeychainIDs
            }
        };
    } catch (err: any) {
        console.log('error from getOwnedSuperiorKeychainIDs: ', err.message);
        return {
            status: Status.ERROR,
            message: `(getOwnedSuperiorKeychainIDs) Error: ${err.message}`
        };
    }
}

/**
 * Fetches all metadata of the Key of Salvation NFTs from the kosMetadata.json file.
 */
export const fetchKOSMetadataFile = (): KOSMetadata[] => {
    const metadataFile = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, '../utils/kosMetadata.json'), 'utf8')
    ) as KOSMetadata[];

    return metadataFile;
}

/**
 * Fetches the `KOSExplicitOwnership` instance for each of the Key of Salvation NFTs from the contract using `explicitOwnershipsOf`.
 */
export const explicitOwnershipsOfKOS = async (keyIds: number[]): Promise<ReturnValue> => {
    if (!keyIds || keyIds.length === 0) {
        return {
            status: Status.SUCCESS,
            message: `(checkKeyOwnerships) No key IDs provided.`,
            data: {
                keyOwnerships: []
            }
        }
    }

    try {
        // call `explicitOwnershipsOf` in the contract for all key IDs and convert it to use `KOSExplicitOwnership`
        const keyOwnerships = await KOS_CONTRACT.explicitOwnershipsOf(keyIds);

        const formattedOwnerships: KOSExplicitOwnership[] = keyOwnerships.map((ownership: any, index: number) => {
            return {
                // get the key ID
                tokenId: keyIds[index],
                owner: ownership.addr,
                // convert startTimestamp to unix
                startTimestamp: ownership.startTimestamp.toNumber(),
                burned: ownership.burned,
                extraData: ownership.extraData
            }
        })

        return {
            status: Status.SUCCESS,
            message: `(checkKeyOwnerships) Successfully checked key ownerships.`,
            data: {
                keyOwnerships: formattedOwnerships
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(checkKeyOwnerships) Error: ${err.message}`
        }
    }
}

/**
 * Fetches the `KOSExplicitOwnership` instance for each of the Keychain NFTs from the contract using `explicitOwnershipsOf`.
 */
export const explicitOwnershipsOfKeychain = async (keychainIds: number[]): Promise<ReturnValue> => {
    if (!keychainIds || keychainIds.length === 0) {
        return {
            status: Status.SUCCESS,
            message: `(explicitOwnershipsOfKeychain) No keychain IDs provided.`,
            data: {
                keychainOwnerships: []
            }
        }
    }

    try {
        // call `explicitOwnershipsOf` in the contract for all keychain IDs and convert it to use `KOSExplicitOwnership`
        const keychainOwnerships = await KEYCHAIN_CONTRACT.explicitOwnershipsOf(keychainIds);

        // we can use the KOSExplicitOwnership interface here because the struct is the same for both Key of Salvation and Keychain
        const formattedOwnerships: KOSExplicitOwnership[] = keychainOwnerships.map((ownership: any, index: number) => {
            return {
                // get the keychain ID
                tokenId: keychainIds[index],
                owner: ownership.addr,
                // convert startTimestamp to unix
                startTimestamp: ownership.startTimestamp.toNumber(),
                burned: ownership.burned,
                extraData: ownership.extraData
            }
        })

        return {
            status: Status.SUCCESS,
            message: `(explicitOwnershipsOfKeychain) Successfully checked keychain ownerships.`,
            data: {
                keychainOwnerships: formattedOwnerships
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(explicitOwnershipsOfKeychain) Error: ${err.message}`
        }
    }
}

/**
 * Fetches the `KOSExplicitOwnership` instance for each of the Superior Keychain NFTs from the contract using `explicitOwnershipsOf`.
 */
export const explicitOwnershipsOfSuperiorKeychain = async (superiorKeychainIds: number[]): Promise<ReturnValue> => {
    if (!superiorKeychainIds || superiorKeychainIds.length === 0) {
        return {
            status: Status.SUCCESS,
            message: `(checkSuperiorKeychainOwnerships) No superior keychain IDs provided.`,
            data: {
                superiorKeychainOwnerships: []
            }
        }
    }

    try {
        // call `explicitOwnershipsOf` in the contract for all superior keychain IDs and convert it to use `KOSExplicitOwnership`
        const superiorKeychainOwnerships = await SUPERIOR_KEYCHAIN_CONTRACT.explicitOwnershipsOf(superiorKeychainIds);

        // we can use the KOSExplicitOwnership interface here because the struct is the same for both Key of Salvation and Superior Keychain
        const formattedOwnerships: KOSExplicitOwnership[] = superiorKeychainOwnerships.map((ownership: any, index: number) => {
            return {
                // get the superior keychain ID
                tokenId: superiorKeychainIds[index],
                owner: ownership.addr,
                // convert startTimestamp to unix
                startTimestamp: ownership.startTimestamp.toNumber(),
                burned: ownership.burned,
                extraData: ownership.extraData
            }
        })

        return {
            status: Status.SUCCESS,
            message: `(checkSuperiorKeychainOwnerships) Successfully checked superior keychain ownerships.`,
            data: {
                superiorKeychainOwnerships: formattedOwnerships
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(checkSuperiorKeychainOwnerships) Error: ${err.message}`
        }
    }
}