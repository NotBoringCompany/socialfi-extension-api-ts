import { ReturnValue, Status } from '../utils/retVal';
import { generateObjectId } from '../utils/crypto';
import { LeaderboardModel, SquadLeaderboardModel, SquadModel, UserModel, WeeklyMVPClaimableRewardsModel } from '../utils/constants/db';
import {
    GET_SEASON_0_PLAYER_LEVEL,
    GET_SEASON_0_PLAYER_LEVEL_REWARDS,
    WEEKLY_MVP_REWARDS,
} from '../utils/constants/user';
import { BitOrbType } from '../models/bitOrb';
import { TerraCapsulatorType } from '../models/terraCapsulator';
import { Item } from '../models/item';
import { LeaderboardPointsSource, LeaderboardUserData } from '../models/leaderboard';
import { WeeklyMVPRewardType } from '../models/weeklyMVPReward';
import { XCookieData } from '../models/user';
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
            xCookiesSpent: number;
            bitOrbsConsumed: number;
            terraCapsulatorsConsumed: number;
        }[] = [];

        for (const user of users) {
            const xCookiesSpent = (user.inventory.xCookieData as XCookieData).weeklyXCookiesSpent ?? 0;

            const bitOrbsConsumed = (user.inventory.items as Item[]).reduce((acc, item) => {
                if (item.type === BitOrbType.BIT_ORB_I || item.type === BitOrbType.BIT_ORB_II || item.type === BitOrbType.BIT_ORB_III) {
                    return acc + item.weeklyAmountConsumed;
                }
                return acc;
            }, 0);
            const terraCapsulatorsConsumed = (user.inventory.items as Item[]).reduce((acc, item) => {
                if (item.type === TerraCapsulatorType.TERRA_CAPSULATOR_I || item.type === TerraCapsulatorType.TERRA_CAPSULATOR_II) {
                    return acc + item.weeklyAmountConsumed;
                }
                return acc;
            }, 0);

            mvpData.push({
                userId: user._id,
                username: user.twitterUsername,
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
                    xCookiesSpent: xCookiesMVPData.xCookiesSpent
                },
                bitOrbsMVP: {
                    userId: bitOrbsMVPData.userId,
                    username: bitOrbsMVPData.username,
                    bitOrbsConsumed: bitOrbsMVPData.bitOrbsConsumed
                },
                terraCapsulatorsMVP: {
                    userId: terraCapsulatorsMVPData.userId,
                    username: terraCapsulatorsMVPData.username,
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
 * Distributes the weekly MVP rewards based on which users spends the most xCookies, or consumes the most bit orbs/terra capsulators.
 * 
 * Called by a scheduler every Sunday 23:59 UTC BEFORE calling `resetWeeklyXCookiesSpent` and `resetWeeklyItemsConsumed`.
 */
export const distributeWeeklyMVPRewards = async (): Promise<void> => {
    try {
        const users = await UserModel.find().lean();

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
            const xCookiesSpent = (user.inventory.xCookieData as XCookieData).weeklyXCookiesSpent ?? 0;

            const bitOrbsConsumed = (user.inventory.items as Item[]).reduce((acc, item) => {
                if (item.type === BitOrbType.BIT_ORB_I || item.type === BitOrbType.BIT_ORB_II || item.type === BitOrbType.BIT_ORB_III) {
                    return acc + item.weeklyAmountConsumed;
                }
                return acc;
            }, 0);
            const terraCapsulatorsConsumed = (user.inventory.items as Item[]).reduce((acc, item) => {
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
                        amount: WEEKLY_MVP_REWARDS('xCookies')
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
                    amount: WEEKLY_MVP_REWARDS('xCookies')
                };
            } else {
                xCookiesMVPRewardsUpdateOperations.$inc[`claimableRewards.${leaderboardPointsIndex}.amount`] = WEEKLY_MVP_REWARDS('xCookies');
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
                        amount: WEEKLY_MVP_REWARDS('Bit Orb')
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
                    amount: WEEKLY_MVP_REWARDS('Bit Orb')
                };
            } else {
                bitOrbsMVPRewardsUpdateOperations.$inc[`claimableRewards.${leaderboardPointsIndex}.amount`] = WEEKLY_MVP_REWARDS('Bit Orb');
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
                        amount: WEEKLY_MVP_REWARDS('Terra Capsulator')
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
                    amount: WEEKLY_MVP_REWARDS('Terra Capsulator')
                };
            } else {
                terraCapsulatorsMVPRewardsUpdateOperations.$inc[`claimableRewards.${leaderboardPointsIndex}.amount`] = WEEKLY_MVP_REWARDS('Terra Capsulator');
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

        const claimableLeaderboardPoints = weeklyMVPRewards.claimableRewards.findIndex(reward => reward.type === WeeklyMVPRewardType.LEADERBOARD_POINTS);

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

        // execute the update operations
        await Promise.all([
            LeaderboardModel.updateOne({ name: 'Season 0' }, leaderboardUpdateOperations),
            SquadModel.updateOne({ _id: user.inGameData.squadId }, squadUpdateOperations),
            SquadLeaderboardModel.updateOne({ week: latestSquadLeaderboard.week }, squadLeaderboardUpdateOperations),
            // set the claimableRewards back to an empty array.
            WeeklyMVPClaimableRewardsModel.updateOne({ userId: user._id }, { $set: { claimableRewards: [] } }),
            UserModel.updateOne({ twitterId }, userUpdateOperations)
        ]);

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