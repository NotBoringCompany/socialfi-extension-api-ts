import mongoose from 'mongoose';
import { ReferralReward, StarterCodeData } from '../models/invite';
import { LeaderboardModel, StarterCodeModel, UserModel } from '../utils/constants/db';
import { generateObjectId, generateStarterCode } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';
import { LeaderboardPointsSource, LeaderboardUserData } from '../models/leaderboard';
import { ExtendedXCookieData, XCookieSource } from '../models/user';
import { GET_SEASON_0_PLAYER_LEVEL, GET_SEASON_0_PLAYER_LEVEL_REWARDS } from '../utils/constants/user';

/**
 * Generates starter codes and stores them in the database.
 * 
 * `amount` is the amount of starter codes to generate.
 * 
 * `maxUses`'s length should be equal to `amount`, and each element represents the maximum uses for each starter code.
 */
export const generateStarterCodes = async (
    amount: number,
    maxUses: number[],
    adminKey: string,
): Promise<ReturnValue> => {
    if (adminKey !== process.env.ADMIN_KEY) {
        return {
            status: Status.UNAUTHORIZED,
            message: `(generateStarterCodes) Invalid admin key.`
        }
    }

    try {
        if (amount !== maxUses.length) {
            return {
                status: Status.ERROR,
                message: `(generateStarterCodes) Amount of starter codes does not match amount of max uses.`
            }
        }

        const starterCodes: Array<any> = [];

        for (let i = 0; i < amount; i++) {
            const code = generateStarterCode();

            starterCodes.push({
                _id: generateObjectId(),
                code,
                maxUses: maxUses[i],
                usedBy: []
            });
        }

        await StarterCodeModel.insertMany(starterCodes);

        return {
            status: Status.SUCCESS,
            message: `(generateStarterCodes) Starter codes generated.`,
            data: {
                starterCodes
            }
        }
    } catch (err: any) {
        console.log('(generateStarterCodes)', err.message);
        return {
            status: Status.ERROR,
            message: `(generateStarterCodes) ${err.message}`
        }
    }
}

/**
 * (User) Claims a user's referral rewards (if any) (For Season 0).
 */
export const claimReferralRewards = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimReferralRewards) User not found.`
            }
        }

        const userUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {}
        }

        const leaderboardUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {}
        }

        // check if the user's `referralData.claimableReferralRewards` is empty
        const claimableReferralRewards: ReferralReward = user.referralData?.claimableReferralRewards;

        // if the user has claimable xCookies, add to the user's inventory and reset the claimable xCookies
        if (claimableReferralRewards.xCookies > 0) {
            userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = claimableReferralRewards.xCookies;

            // check if the user's `xCookieData.extendedXCookieData` contains a source called REFERRAL_REWARDS.
            // if yes, we increment the amount, if not, we create a new entry for the source
            const referralRewardsIndex = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(data => data.source === XCookieSource.REFERRAL_REWARDS);

            if (referralRewardsIndex !== -1) {
                userUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${referralRewardsIndex}.xCookies`] = claimableReferralRewards.xCookies;
            } else {
                userUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = {
                    xCookies: claimableReferralRewards.xCookies,
                    source: XCookieSource.REFERRAL_REWARDS,
                }
            }

            // set the claimable xCookies to 0
            userUpdateOperations.$set['referralData.claimableReferralRewards.xCookies'] = 0;
        }

        // if the user has claimable leaderboard points, add to the Season 0 leaderboard and reset the claimable leaderboard points
        if (claimableReferralRewards.leaderboardPoints > 0) {
            // get the leaderboard for season 0
            const leaderboard = await LeaderboardModel.findOne({ name: 'Season 0' }).lean();

            if (!leaderboard) {
                return {
                    status: Status.ERROR,
                    message: `(claimReferralRewards) Leaderboard not found.`
                }
            }

            // check if the user exists in the leaderboard's `userData`
            const userIndex = (leaderboard.userData as LeaderboardUserData[]).findIndex(userData => userData.userId === user._id);

            let additionalPoints = 0;

            const currentLevel = user.inGameData.level;

            // if the user is not found, we create a new entry for the user
            if (userIndex === -1) {
                const newLevel = GET_SEASON_0_PLAYER_LEVEL(claimableReferralRewards.leaderboardPoints);

                // if user levelled up, set the user's `inGameData.level` to the new level
                if (newLevel > currentLevel) {
                    userUpdateOperations.$set['inGameData.level'] = newLevel;
                    additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);
                }

                leaderboardUpdateOperations.$push['userData'] = {
                    userId: user._id,
                    twitterProfilePicture: user.twitterProfilePicture,
                    pointsData: [
                        {
                            points: claimableReferralRewards.leaderboardPoints,
                            source: LeaderboardPointsSource.REFERRAL_REWARDS
                        }, {
                            points: additionalPoints,
                            source: LeaderboardPointsSource.LEVELLING_UP
                        }
                    ]
                }
            } else {
                // get the user's total leaderboard points
                // this is done by summing up all the points from the `pointsData` array, BUT EXCLUDING SOURCES FROM:
                // 1. LeaderboardPointsSource.LEVELLING_UP
                const totalLeaderboardPoints = leaderboard.userData[userIndex].pointsData.reduce((acc, pointsData) => {
                    if (pointsData.source !== LeaderboardPointsSource.LEVELLING_UP) {
                        return acc + pointsData.points;
                    }

                    return acc;
                }, 0);

                const newLevel = GET_SEASON_0_PLAYER_LEVEL(totalLeaderboardPoints + claimableReferralRewards.leaderboardPoints);

                if (newLevel > currentLevel) {
                    userUpdateOperations.$set['inGameData.level'] = newLevel;
                    additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);
                }

                // if the user is found, we increment the points

                const pointsData = leaderboard.userData[userIndex].pointsData;

                const sourceIndex = pointsData.findIndex(pointsData => pointsData.source === LeaderboardPointsSource.REFERRAL_REWARDS);

                if (sourceIndex === -1) {
                    leaderboardUpdateOperations.$push[`userData.${userIndex}.pointsData`] = {
                        points: claimableReferralRewards.leaderboardPoints,
                        source: LeaderboardPointsSource.REFERRAL_REWARDS
                    }
                } else {
                    leaderboardUpdateOperations.$inc[`userData.${userIndex}.pointsData.${sourceIndex}.points`] = claimableReferralRewards.leaderboardPoints;
                }

                if (additionalPoints > 0) {
                    const levelUpIndex = pointsData.findIndex(pointsData => pointsData.source === LeaderboardPointsSource.LEVELLING_UP);

                    if (levelUpIndex === -1) {
                        leaderboardUpdateOperations.$push[`userData.${userIndex}.pointsData`] = {
                            points: additionalPoints,
                            source: LeaderboardPointsSource.LEVELLING_UP
                        }
                    } else {
                        leaderboardUpdateOperations.$inc[`userData.${userIndex}.pointsData.${levelUpIndex}.points`] = additionalPoints;
                    }
                }
            }

            // set the claimable leaderboard points to 0
            userUpdateOperations.$set['referralData.claimableReferralRewards.leaderboardPoints'] = 0;
        }

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            LeaderboardModel.updateOne({ name: 'Season 0' }, leaderboardUpdateOperations)
        ]);

        return {
            status: Status.SUCCESS,
            message: `(claimReferralRewards) Referral rewards claimed.`,
            data: {
                claimableReferralRewards
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimReferralRewards) ${err.message}`
        }
    }
}