import { ReturnValue, Status } from '../utils/retVal';
import { generateObjectId } from '../utils/crypto';
import { LeaderboardModel, SquadLeaderboardModel, SquadModel, UserModel, WeeklyMVPClaimableRewardsModel, WeeklyMVPRankingLeaderboardModel } from '../utils/constants/db';
import {
    GET_SEASON_0_PLAYER_LEVEL,
    GET_SEASON_0_PLAYER_LEVEL_REWARDS,
    WEEKLY_MVP_REWARDS,
} from '../utils/constants/user';
import { BitOrbType } from '../models/bitOrb';
import { TerraCapsulatorType } from '../models/terraCapsulator';
import { Item } from '../models/item';
import { LeaderboardPointsSource, LeaderboardUserData } from '../models/leaderboard';
import { WeeklyMVPRankingData, WeeklyMVPReward, WeeklyMVPRewardType } from '../models/weeklyMVPReward';
import { XCookieData } from '../models/user';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Fetches the current contenders to be the weekly MVP for most xCookies spent or most terra caps/bit orbs consumed.
 */
export const getWeeklyMVPContenders = async (): Promise<ReturnValue> => {
    try {
        const users = await UserModel.find({}).lean();

        if (!users || users.length === 0) {
            return {
                status: Status.ERROR,
                message: `(getWeeklyMVPContenders) No users found.`
            }
        }

        // loop through each user and find the users with:
        // 1. the most xCookies spent (i.e. `inventory.xCookieData.weeklyXCookiesSpent`)
        // 2. the most bit orbs consumed (i.e. `inventory.items.weeklyAmountConsumed` for Bit Orb (I), (II), and (III))
        // 3. the most terra capsulators consumed (i.e. `inventory.items.weeklyAmountConsumed` for Terra Capsulator (I), (II))
        const mvpData: {
            userId: string;
            username: string;
            twitterProfilePicture: string;
            xCookiesSpent: number;
            bitOrbsConsumed: number;
            terraCapsulatorsConsumed: number;
        }[] = [];

        for (const user of users) {
            const userItems = !user.inventory?.items || user.inventory?.items.length === 0 ? [] : user.inventory.items as Item[];

            const xCookiesSpent = (user.inventory?.xCookieData as XCookieData)?.weeklyXCookiesSpent ?? 0;

            const bitOrbsConsumed = !userItems || userItems.length === 0 ? 0 :
                userItems.reduce((acc, item) => {
                    if (item.type === BitOrbType.BIT_ORB_I || item.type === BitOrbType.BIT_ORB_II || item.type === BitOrbType.BIT_ORB_III) {
                        return acc + item.weeklyAmountConsumed;
                    }
                    return acc;
                }, 0);

            const terraCapsulatorsConsumed = !userItems || userItems.length ? 0 :
                userItems.reduce((acc, item) => {
                    if (item.type === TerraCapsulatorType.TERRA_CAPSULATOR_I || item.type === TerraCapsulatorType.TERRA_CAPSULATOR_II) {
                        return acc + item.weeklyAmountConsumed;
                    }
                    return acc;
                }, 0);

            mvpData.push({
                userId: user._id,
                username: user.twitterUsername,
                twitterProfilePicture: user.twitterProfilePicture,
                xCookiesSpent,
                bitOrbsConsumed,
                terraCapsulatorsConsumed,
            });
        }

        // sort the MVP data by the most xCookies spent and get the highest spender
        const xCookiesMVPData = mvpData.sort((a, b) => b.xCookiesSpent - a.xCookiesSpent)[0];

        // sort the MVP data by the most bit orbs consumed and get the highest consumer
        const bitOrbsMVPData = mvpData.sort((a, b) => b.bitOrbsConsumed - a.bitOrbsConsumed)[0];

        // sort the MVP data by the most terra capsulators consumed and get the highest consumer
        const terraCapsulatorsMVPData = mvpData.sort((a, b) => b.terraCapsulatorsConsumed - a.terraCapsulatorsConsumed)[0];

        return {
            status: Status.SUCCESS,
            message: `(getWeeklyMVPContenders) Weekly MVP contenders fetched.`,
            data: {
                xCookiesMVP: {
                    userId: xCookiesMVPData.userId,
                    username: xCookiesMVPData.username,
                    profilePicture: xCookiesMVPData.twitterProfilePicture,
                    xCookiesSpent: xCookiesMVPData.xCookiesSpent
                },
                bitOrbsMVP: {
                    userId: bitOrbsMVPData.userId,
                    username: bitOrbsMVPData.username,
                    profilePicture: bitOrbsMVPData.twitterProfilePicture,
                    bitOrbsConsumed: bitOrbsMVPData.bitOrbsConsumed
                },
                terraCapsulatorsMVP: {
                    userId: terraCapsulatorsMVPData.userId,
                    username: terraCapsulatorsMVPData.username,
                    profilePicture: terraCapsulatorsMVPData.twitterProfilePicture,
                    terraCapsulatorsConsumed: terraCapsulatorsMVPData.terraCapsulatorsConsumed
                }
            }
        }
    } catch (err: any) {
        console.error('(getWeeklyMVPContenders)', err.message);
        return {
            status: Status.ERROR,
            message: `(getWeeklyMVPContenders) ${err.message}`
        }
    }
}

/**
 * Fetches the weekly MVP ranking data for the specified week. If 'latest', then it fetches the latest weekly MVP ranking data.
 */
export const fetchWeeklyMVPRankingData = async (week: number | 'latest'): Promise<ReturnValue> => {
    try {
        const weeklyMVPRankingData: WeeklyMVPRankingData = week === 'latest' ? await WeeklyMVPRankingLeaderboardModel.findOne().sort({ week: -1 }).lean() : await WeeklyMVPRankingLeaderboardModel.findOne({ week }).lean();

        if (!weeklyMVPRankingData) {
            return {
                status: Status.ERROR,
                message: `(fetchWeeklyMVPRankingData) Weekly MVP ranking data not found.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(fetchWeeklyMVPRankingData) Weekly MVP ranking data fetched.`,
            data: {
                weeklyMVPRankingData
            }
        }

    } catch (err: any) {
        console.error('(fetchWeeklyMVPRankingData)', err.message);
        return {
            status: Status.ERROR,
            message: `(fetchWeeklyMVPRankingData) ${err.message}`
        }
    }
}

/**
 * Distributes the weekly MVP rewards based on which users spends the most xCookies, or consumes the most bit orbs/terra capsulators.
 * 
 * Called by a scheduler every Sunday 23:59 UTC BEFORE calling `resetWeeklyXCookiesSpent` and `resetWeeklyItemsConsumed`.
 */
export const distributeWeeklyMVPRewards = async (): Promise<void> => {
    try {
        const users = await UserModel.find({ twitterId: { $ne: null, $exists: true } }).lean();

        if (users.length === 0 || !users) {
            return;
        }

        // loop through each user and find the users with:
        // 1. the most xCookies spent (i.e. `inventory.xCookieData.weeklyXCookiesSpent`)
        // 2. the most bit orbs consumed (i.e. `inventory.items.weeklyAmountConsumed` for Bit Orb (I), (II), and (III))
        // 3. the most terra capsulators consumed (i.e. `inventory.items.weeklyAmountConsumed` for Terra Capsulator (I), (II))
        const mvpData: {
            userId: string;
            username: string;
            twitterProfilePicture: string;
            xCookiesSpent: number;
            bitOrbsConsumed: number;
            terraCapsulatorsConsumed: number;
        }[] = [];

        for (const user of users) {
            const userItems = !user.inventory?.items || user.inventory?.items.length === 0 ? [] : user.inventory.items as Item[];

            const xCookiesSpent = (user.inventory.xCookieData as XCookieData)?.weeklyXCookiesSpent ?? 0;

            const bitOrbsConsumed = !userItems || userItems.length === 0 ? 0 :
                userItems.reduce((acc, item) => {
                    if (item.type === BitOrbType.BIT_ORB_I || item.type === BitOrbType.BIT_ORB_II || item.type === BitOrbType.BIT_ORB_III) {
                        return acc + item.weeklyAmountConsumed;
                    }
                    return acc;
                }, 0);

            const terraCapsulatorsConsumed = !userItems || userItems.length ? 0 :
                userItems.reduce((acc, item) => {
                    if (item.type === TerraCapsulatorType.TERRA_CAPSULATOR_I || item.type === TerraCapsulatorType.TERRA_CAPSULATOR_II) {
                        return acc + item.weeklyAmountConsumed;
                    }
                    return acc;
                }, 0);

            mvpData.push({
                userId: user._id,
                username: user.twitterUsername,
                twitterProfilePicture: user.twitterProfilePicture,
                xCookiesSpent,
                bitOrbsConsumed,
                terraCapsulatorsConsumed,
            });
        }

        // sort the MVP data by the most xCookies spent and get the highest spender
        const xCookiesMVPData = mvpData.sort((a, b) => b.xCookiesSpent - a.xCookiesSpent)[0];

        // sort the MVP data by the most bit orbs consumed and get the highest consumer
        const bitOrbsMVPData = mvpData.sort((a, b) => b.bitOrbsConsumed - a.bitOrbsConsumed)[0];

        // sort the MVP data by the most terra capsulators consumed and get the highest consumer
        const terraCapsulatorsMVPData = mvpData.sort((a, b) => b.terraCapsulatorsConsumed - a.terraCapsulatorsConsumed)[0];

        const xCookiesMVPRewardsUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {},
        }

        const bitOrbsMVPRewardsUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {},
        }

        const terraCapsulatorsMVPRewardsUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {},
        }

        // fetch the `WeeklyMVPClaimableRewards` model
        const xCookiesMVP = await WeeklyMVPClaimableRewardsModel.findOne({ userId: xCookiesMVPData.userId });
        const bitOrbsMVP = await WeeklyMVPClaimableRewardsModel.findOne({ userId: bitOrbsMVPData.userId });
        const terraCapsulatorsMVP = await WeeklyMVPClaimableRewardsModel.findOne({ userId: terraCapsulatorsMVPData.userId });

        // check, for each mvp, if each of them exists. if not, create a new entry.
        if (!xCookiesMVP) {
            const newXCookiesMVP = new WeeklyMVPClaimableRewardsModel({
                _id: generateObjectId(),
                userId: xCookiesMVPData.userId,
                username: xCookiesMVPData.username,
                twitterProfilePicture: xCookiesMVPData.twitterProfilePicture,
                claimableRewards: [
                    {
                        type: WeeklyMVPRewardType.LEADERBOARD_POINTS,
                        amount: WEEKLY_MVP_REWARDS('xCookies').leaderboardPoints
                    }
                ]
            });

            await newXCookiesMVP.save();

            console.log(`Created new xCookies MVP entry for user ${xCookiesMVPData.username}.`);
        } else {
            // find the leaderboard points index
            const leaderboardPointsIndex = xCookiesMVP.claimableRewards.findIndex(reward => reward.type === WeeklyMVPRewardType.LEADERBOARD_POINTS);

            // if it doesn't exist, create a new entry
            if (leaderboardPointsIndex === -1) {
                xCookiesMVPRewardsUpdateOperations.$push['claimableRewards'] = {
                    type: WeeklyMVPRewardType.LEADERBOARD_POINTS,
                    amount: WEEKLY_MVP_REWARDS('xCookies').leaderboardPoints
                };
            } else {
                xCookiesMVPRewardsUpdateOperations.$inc[`claimableRewards.${leaderboardPointsIndex}.amount`] = WEEKLY_MVP_REWARDS('xCookies').leaderboardPoints;
            }

            console.log(`Updated xCookies MVP entry for user ${xCookiesMVPData.username}.`);
        }

        if (!bitOrbsMVP) {
            const newBitOrbsMVP = new WeeklyMVPClaimableRewardsModel({
                _id: generateObjectId(),
                userId: bitOrbsMVPData.userId,
                username: bitOrbsMVPData.username,
                twitterProfilePicture: bitOrbsMVPData.twitterProfilePicture,
                claimableRewards: [
                    {
                        type: WeeklyMVPRewardType.LEADERBOARD_POINTS,
                        amount: WEEKLY_MVP_REWARDS('Bit Orb').leaderboardPoints
                    }
                ]
            });

            await newBitOrbsMVP.save();

            console.log(`Created new Bit Orbs MVP entry for user ${bitOrbsMVPData.username}.`);
        } else {
            // find the leaderboard points index
            const leaderboardPointsIndex = bitOrbsMVP.claimableRewards.findIndex(reward => reward.type === WeeklyMVPRewardType.LEADERBOARD_POINTS);

            // if it doesn't exist, create a new entry
            if (leaderboardPointsIndex === -1) {
                bitOrbsMVPRewardsUpdateOperations.$push['claimableRewards'] = {
                    type: WeeklyMVPRewardType.LEADERBOARD_POINTS,
                    amount: WEEKLY_MVP_REWARDS('Bit Orb').leaderboardPoints
                };
            } else {
                bitOrbsMVPRewardsUpdateOperations.$inc[`claimableRewards.${leaderboardPointsIndex}.amount`] = WEEKLY_MVP_REWARDS('Bit Orb').leaderboardPoints;
            }

            console.log(`Updated Bit Orbs MVP entry for user ${bitOrbsMVPData.username}.`);
        }

        if (!terraCapsulatorsMVP) {
            const newTerraCapsulatorsMVP = new WeeklyMVPClaimableRewardsModel({
                _id: generateObjectId(),
                userId: terraCapsulatorsMVPData.userId,
                username: terraCapsulatorsMVPData.username,
                twitterProfilePicture: terraCapsulatorsMVPData.twitterProfilePicture,
                claimableRewards: [
                    {
                        type: WeeklyMVPRewardType.LEADERBOARD_POINTS,
                        amount: WEEKLY_MVP_REWARDS('Terra Capsulator').leaderboardPoints
                    }
                ]
            });

            await newTerraCapsulatorsMVP.save();

            console.log(`Created new Terra Capsulators MVP entry for user ${terraCapsulatorsMVPData.username}.`);
        } else {
            // find the leaderboard points index
            const leaderboardPointsIndex = terraCapsulatorsMVP.claimableRewards.findIndex(reward => reward.type === WeeklyMVPRewardType.LEADERBOARD_POINTS);

            // if it doesn't exist, create a new entry
            if (leaderboardPointsIndex === -1) {
                terraCapsulatorsMVPRewardsUpdateOperations.$push['claimableRewards'] = {
                    type: WeeklyMVPRewardType.LEADERBOARD_POINTS,
                    amount: WEEKLY_MVP_REWARDS('Terra Capsulator').leaderboardPoints
                };
            } else {
                terraCapsulatorsMVPRewardsUpdateOperations.$inc[`claimableRewards.${leaderboardPointsIndex}.amount`] = WEEKLY_MVP_REWARDS('Terra Capsulator').leaderboardPoints;
            }

            console.log(`Updated Terra Capsulators MVP entry for user ${terraCapsulatorsMVPData.username}.`);
        }

        // execute the update operations (synchronously, just in case they're the same user)
        await WeeklyMVPClaimableRewardsModel.updateOne({ userId: xCookiesMVPData.userId }, xCookiesMVPRewardsUpdateOperations);
        await WeeklyMVPClaimableRewardsModel.updateOne({ userId: bitOrbsMVPData.userId }, bitOrbsMVPRewardsUpdateOperations);
        await WeeklyMVPClaimableRewardsModel.updateOne({ userId: terraCapsulatorsMVPData.userId }, terraCapsulatorsMVPRewardsUpdateOperations);

        console.log('Weekly MVP rewards distributed.');
    } catch (err: any) {
        console.error('Error in distributeWeeklyMVPRewards:', err.message);
    }
}

/**
 * Claims the weekly MVP rewards for the user.
 */
export const claimWeeklyMVPRewards = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimWeeklyMVPRewards) User not found.`,
            };
        }

        const weeklyMVPRewards = await WeeklyMVPClaimableRewardsModel.findOne({ userId: user._id });

        if (!weeklyMVPRewards) {
            return {
                status: Status.BAD_REQUEST,
                message: `(claimWeeklyMVPRewards) Weekly MVP rewards not found for user.`,
            };
        }

        // check if the user has any claimable rewards
        if (weeklyMVPRewards.claimableRewards.length === 0) {
            return {
                status: Status.BAD_REQUEST,
                message: `(claimWeeklyMVPRewards) No claimable rewards.`,
            };
        }

        // for now, because `WeeklyMVPRewardType` only has `LEADERBOARD_POINTS`, we only check for that.
        const leaderboardUpdateOperations = {
            $inc: {},
            $push: {},
            $pull: {},
            $set: {}
        }

        const squadUpdateOperations = {
            $inc: {},
            $push: {},
            $pull: {},
            $set: {}
        }

        const squadLeaderboardUpdateOperations = {
            $inc: {},
            $push: {},
            $pull: {},
            $set: {}
        }

        const userUpdateOperations = {
            $inc: {},
            $push: {},
            $pull: {},
            $set: {}
        }

        const claimableLeaderboardPointsIndex = (weeklyMVPRewards.claimableRewards as WeeklyMVPReward[]).findIndex(reward => reward.type === WeeklyMVPRewardType.LEADERBOARD_POINTS);
        const claimableLeaderboardPoints = (weeklyMVPRewards.claimableRewards as WeeklyMVPReward[])[claimableLeaderboardPointsIndex].amount;

        const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 }).lean();

        if (!latestSquadLeaderboard) {
            return {
                status: Status.ERROR,
                message: `(claimWeeklyMVPRewards) Squad leaderboard not found.`,
            };
        }


        // check if the user exists in the season 0 leaderboard's `userData` array.
        // if not, create a new entry. else:
        // check if the source `WEEKLY_MVP_REWARDS` exists in the user's points data.
        // if it does, increment the points. if not, create a new entry.
        // also, if the user is eligible for additional points, add the additional points to `points`.
        const leaderboard = await LeaderboardModel.findOne({ name: 'Season 0' }).lean();

        if (!leaderboard) {
            return {
                status: Status.ERROR,
                message: `(claimWeeklyMVPRewards) Leaderboard not found.`,
            };
        }

        const userIndex = (leaderboard.userData as LeaderboardUserData[]).findIndex(data => data.userId === user._id);

        let additionalPoints = 0;

        const currentLevel = user.inGameData.level;

        if (userIndex === -1) {
            // check if the user is eligible to level up to the next level
            const newLevel = GET_SEASON_0_PLAYER_LEVEL(claimableLeaderboardPoints);

            if (newLevel > currentLevel) {
                userUpdateOperations.$set['inGameData.level'] = newLevel;

                // add the additional points based on the rewards obtainable
                additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);
            }

            leaderboardUpdateOperations.$push['userData'] = {
                userId: user._id,
                username: user.twitterUsername,
                twitterProfilePicture: user.twitterProfilePicture,
                pointsData: [
                    {
                        points: claimableLeaderboardPoints,
                        source: LeaderboardPointsSource.WEEKLY_MVP_REWARDS
                    },
                    {
                        points: additionalPoints,
                        source: LeaderboardPointsSource.LEVELLING_UP
                    }
                ]
            }
        } else {
            // if user is found, get the user's total leaderboard points
            // this is done by summing up all the points from the `pointsData` array, BUT EXCLUDING SOURCES FROM:
            // 1. LeaderboardPointsSource.LEVELLING_UP
            const totalLeaderboardPoints = leaderboard.userData[userIndex].pointsData.reduce((acc, pointsData) => {
                if (pointsData.source !== LeaderboardPointsSource.LEVELLING_UP) {
                    return acc + pointsData.points;
                }

                return acc;
            }, 0);

            const newLevel = GET_SEASON_0_PLAYER_LEVEL(totalLeaderboardPoints + claimableLeaderboardPoints);

            if (newLevel > currentLevel) {
                userUpdateOperations.$set['inGameData.level'] = newLevel;
                additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);
            }

            // get the source index for `WEEKLY_MVP_REWARDS`
            const sourceIndex = leaderboard.userData[userIndex].pointsData.findIndex(data => data.source === LeaderboardPointsSource.WEEKLY_MVP_REWARDS);

            if (sourceIndex !== -1) {
                leaderboardUpdateOperations.$inc[`userData.${userIndex}.pointsData.${sourceIndex}.points`] = claimableLeaderboardPoints;
            } else {
                leaderboardUpdateOperations.$push[`userData.${userIndex}.pointsData`] = {
                    points: claimableLeaderboardPoints,
                    source: LeaderboardPointsSource.KOS_BENEFITS
                }
            }

            if (additionalPoints > 0) {
                const levellingUpIndex = leaderboard.userData[userIndex].pointsData.findIndex(data => data.source === LeaderboardPointsSource.LEVELLING_UP);

                if (levellingUpIndex !== -1) {
                    leaderboardUpdateOperations.$inc[`userData.${userIndex}.pointsData.${levellingUpIndex}.points`] = additionalPoints;
                } else {
                    leaderboardUpdateOperations.$push[`userData.${userIndex}.pointsData`] = {
                        points: additionalPoints,
                        source: LeaderboardPointsSource.LEVELLING_UP
                    }
                }
            }
        }

        // if the user is also in a squad, add the points to the squad's total points
        if (user.inGameData.squadId !== null) {
            const squad = await SquadModel.findOne({ _id: user.inGameData.squadId }).lean();

            if (!squad) {
                return {
                    status: Status.ERROR,
                    message: `(claimWeeklyMVPRewards) Squad not found.`,
                };
            }

            // add only the reward amount (i.e. claimableLeaderboardPoints) to the squad's total points
            squadUpdateOperations.$inc['totalSquadPoints'] = claimableLeaderboardPoints;

            // check if the squad exists in the squad leaderboard's `pointsData`. if not, we create a new instance.
            const squadIndex = latestSquadLeaderboard.pointsData.findIndex(data => data.squadId === squad._id);

            if (squadIndex === -1) {
                squadLeaderboardUpdateOperations.$push['pointsData'] = {
                    squadId: squad._id,
                    squadName: squad.name,
                    memberPoints: [
                        {
                            userId: user._id,
                            username: user.twitterUsername,
                            points: claimableLeaderboardPoints
                        }
                    ]
                }
            } else {
                // otherwise, we increment the points for the user in the squad
                const userIndex = latestSquadLeaderboard.pointsData[squadIndex].memberPoints.findIndex(data => data.userId === user._id);

                if (userIndex !== -1) {
                    squadLeaderboardUpdateOperations.$inc[`pointsData.${squadIndex}.memberPoints.${userIndex}.points`] = claimableLeaderboardPoints;
                } else {
                    squadLeaderboardUpdateOperations.$push[`pointsData.${squadIndex}.memberPoints`] = {
                        userId: user._id,
                        username: user.twitterUsername,
                        points: claimableLeaderboardPoints
                    }
                }
            }
        }

        // execute the update operations ($set and $inc, then $push and $pull to prevent conflicts)
        await Promise.all([
            LeaderboardModel.updateOne({ name: 'Season 0' }, {
                $set: leaderboardUpdateOperations.$set,
                $inc: leaderboardUpdateOperations.$inc,
            }),
            SquadModel.updateOne({ _id: user.inGameData.squadId }, {
                $set: squadUpdateOperations.$set,
                $inc: squadUpdateOperations.$inc,
            }),
            SquadLeaderboardModel.updateOne({ week: latestSquadLeaderboard.week }, {
                $set: squadLeaderboardUpdateOperations.$set,
                $inc: squadLeaderboardUpdateOperations.$inc,
            }),
            UserModel.updateOne({ twitterId }, {
                $set: userUpdateOperations.$set,
                $inc: userUpdateOperations.$inc,
            })        
        ]);

        await Promise.all([
            LeaderboardModel.updateOne({ name: 'Season 0' }, {
                $push: leaderboardUpdateOperations.$push,
                $pull: leaderboardUpdateOperations.$pull,
            }),
            SquadModel.updateOne({ _id: user.inGameData.squadId }, {
                $push: squadUpdateOperations.$push,
                $pull: squadUpdateOperations.$pull,
            }),
            SquadLeaderboardModel.updateOne({ week: latestSquadLeaderboard.week }, {
                $push: squadLeaderboardUpdateOperations.$push,
                $pull: squadLeaderboardUpdateOperations.$pull,
            }),
            UserModel.updateOne({ twitterId }, {
                $push: userUpdateOperations.$push,
                $pull: userUpdateOperations.$pull,
            })        
        ])

        // set the claimableRewards back to an empty array.
        await WeeklyMVPClaimableRewardsModel.updateOne({ userId: user._id }, { $set: { claimableRewards: [] } });

        return {
            status: Status.SUCCESS,
            message: `(claimWeeklyMVPRewards) Weekly MVP rewards claimed.`,
            data: {
                leaderboardPoints: claimableLeaderboardPoints,
                additionalPoints
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimWeeklyMVPRewards) ${err.message}`
        }
    }
}

/**
 * Checks if a user has any claimable weekly MVP rewards.
 */
export const getClaimableWeeklyMVPRewards = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getClaimableWeeklyMVPRewards) User not found.`,
            };
        }

        const weeklyMVPRewards = await WeeklyMVPClaimableRewardsModel.findOne({ userId: user._id });

        if (!weeklyMVPRewards) {
            return {
                status: Status.BAD_REQUEST,
                message: `(getClaimableWeeklyMVPRewards) Weekly MVP rewards not found for user.`,
            };
        }

        // check if the user has any claimable rewards
        const claimableRewards = weeklyMVPRewards.claimableRewards;

        return {
            status: Status.SUCCESS,
            message: `(getClaimableWeeklyMVPRewards) Claimable weekly MVP rewards fetched.`,
            data: {
                claimableRewards
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getClaimableWeeklyMVPRewards) ${err.message}`
        }
    }
}

/**
 * Adds a new leaderboard for the weekly MVP ranking each week. 
 * 
 * If the previous week's leaderboard also exists, then the `endTimestamp` of that leaderboard is also updated to the current timestamp.
 */
export const addNewWeeklyMVPRankingLeaderboard = async (): Promise<ReturnValue> => {
    try {
        const latestWeek = await WeeklyMVPRankingLeaderboardModel.findOne().sort({ week: -1 });

        // if there is `latestWeek`, we need to update the `endTimestamp` to the current time.
        if (latestWeek) {
            await WeeklyMVPRankingLeaderboardModel.updateOne({ _id: latestWeek._id }, { $set: { endTimestamp: Math.floor(Date.now() / 1000) } });
        }

        // create the new weekly MVP ranking leaderboard
        const newWeekData = new WeeklyMVPRankingLeaderboardModel({
            _id: generateObjectId(),
            // if this is the first week, set the week to 1. else, increment the latest week by 1.
            week: latestWeek ? latestWeek.week + 1 : 1,
            startTimestamp: Math.floor(Date.now() / 1000),
            // this will be updated via the scheduler when the new week starts
            endTimestamp: 0,
            xCookiesSpentRankingData: [],
            bitOrbsConsumedRankingData: [],
            terraCapsulatorsConsumedRankingData: []
        });

        await newWeekData.save();

        console.log('(addNewWeeklyMVPRankingLeaderboard) New weekly MVP ranking leaderboard created.');

        return {
            status: Status.SUCCESS,
            message: `(addNewWeeklyMVPRankingLeaderboard) New weekly MVP ranking leaderboard created.`
        }
    } catch (err: any) {
        console.log('(addNewWeeklyMVPRankingLeaderboard)', err.message);
        return {
            status: Status.ERROR,
            message: `(addNewWeeklyMVPRankingLeaderboard) ${err.message}`
        }
    }
}

/**
 * Updates the current weekly MVP ranking leaderboard with the latest data (xCookies spent, bit orbs/terra caps consumed, etc.).
 * 
 * This also includes ranking the users based on the highest amount spent/consumed to the lowest, and storing the ranking data in the `WeeklyMVPRanking` model for this week.
 */
export const updateCurrentWeeklyMVPRankingLeaderboard = async (): Promise<ReturnValue> => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const users = await UserModel.find({ twitterId: { $ne: null, $exists: true } }).lean();

        if (!users || users.length === 0) {
            return {
                status: Status.ERROR,
                message: `(updateCurrentWeeklyMVPRankingLeaderboard) No users found.`
            }
        }

        // do the following:
        // 1. loop through each user.
        // 2. for each user, get the user's xCookies spent, bit orbs consumed and terra caps consumed.
        // 3. for each type (xCookies spent, bit orbs consumed, terra caps consumed), sort the users by the highest amount spent/consumed to the lowest, and rank them from 1 to n.
        // 4. store the ranking data in the `WeeklyMVPRanking` model for this week.
        const mvpData: {
            userId: string;
            username: string;
            twitterProfilePicture: string;
            xCookiesSpent: number;
            bitOrbsConsumed: number;
            terraCapsulatorsConsumed: number;
        }[] = [];

        for (const user of users) {
            const userItems = !user.inventory?.items || user.inventory?.items.length === 0 ? [] : user.inventory.items as Item[];

            const xCookiesSpent = (user.inventory?.xCookieData as XCookieData)?.weeklyXCookiesSpent ?? 0;

            const bitOrbsConsumed = !userItems || userItems.length === 0 ? 0 :
                userItems.reduce((acc, item) => {
                    if (item.type === BitOrbType.BIT_ORB_I || item.type === BitOrbType.BIT_ORB_II || item.type === BitOrbType.BIT_ORB_III) {
                        return acc + item.weeklyAmountConsumed;
                    }
                    return acc;
                }, 0);

            const terraCapsulatorsConsumed = !userItems || userItems.length ? 0 :
                userItems.reduce((acc, item) => {
                    if (item.type === TerraCapsulatorType.TERRA_CAPSULATOR_I || item.type === TerraCapsulatorType.TERRA_CAPSULATOR_II) {
                        return acc + item.weeklyAmountConsumed;
                    }
                    return acc;
                }, 0);

            mvpData.push({
                userId: user._id,
                username: user.twitterUsername,
                twitterProfilePicture: user.twitterProfilePicture,
                xCookiesSpent,
                bitOrbsConsumed,
                terraCapsulatorsConsumed,
            });
        }

        // filter any data with 0 amount spent/consumed and then sort the MVP data by the most xCookies spent
        const xCookiesMVPData = mvpData.filter(data => data.xCookiesSpent > 0).sort((a, b) => b.xCookiesSpent - a.xCookiesSpent);
        // filter any data with 0 amount spent/consumed and then sort the MVP data by the most bit orbs consumed
        const bitOrbsMVPData = mvpData.filter(data => data.bitOrbsConsumed > 0).sort((a, b) => b.bitOrbsConsumed - a.bitOrbsConsumed);
        // filter any data with 0 amount spent/consumed and then sort the MVP data by the most terra capsulators consumed
        const terraCapsulatorsMVPData = mvpData.filter(data => data.terraCapsulatorsConsumed > 0).sort((a, b) => b.terraCapsulatorsConsumed - a.terraCapsulatorsConsumed);

        // get the latest week from the `WeeklyMVPRankingData` model
        const latestWeekMVPRankingData = await WeeklyMVPRankingLeaderboardModel.findOne().sort({ week: -1 });

        if (!latestWeekMVPRankingData) {
            return {
                status: Status.ERROR,
                message: `(updateCurrentWeeklyMVPRankingLeaderboard) Weekly MVP ranking data not found.`
            }
        }

        // update the entire database with the new ranking data
        await WeeklyMVPRankingLeaderboardModel.updateOne({ _id: latestWeekMVPRankingData._id }, {
            $set: {
                xCookiesSpentRankingData: xCookiesMVPData.map((data, index) => ({
                    userId: data.userId,
                    username: data.username,
                    twitterProfilePicture: data.twitterProfilePicture,
                    ranking: index + 1,
                    amount: data.xCookiesSpent
                })),
                bitOrbsConsumedRankingData: bitOrbsMVPData.map((data, index) => ({
                    userId: data.userId,
                    username: data.username,
                    twitterProfilePicture: data.twitterProfilePicture,
                    ranking: index + 1,
                    amount: data.bitOrbsConsumed
                })),
                terraCapsulatorsConsumedRankingData: terraCapsulatorsMVPData.map((data, index) => ({
                    userId: data.userId,
                    username: data.username,
                    twitterProfilePicture: data.twitterProfilePicture,
                    ranking: index + 1,
                    amount: data.terraCapsulatorsConsumed
                }))
            }
        });

        console.log('Weekly MVP ranking data updated.');
    } catch (err: any) {
        console.error('(updateCurrentWeeklyMVPRankingLeaderboard)', err.message);

        return {
            status: Status.ERROR,
            message: `(updateCurrentWeeklyMVPRankingLeaderboard) ${err.message}`
        }
    }
}