import mongoose from 'mongoose';
import { IndirectReferralData, ReferralData, ReferralReward, ReferredUserData, StarterCodeData } from '../models/invite';
import { LeaderboardModel, StarterCodeModel, SuccessfulIndirectReferralModel, UserModel } from '../utils/constants/db';
import { generateObjectId, generateStarterCode } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';
import { LeaderboardPointsSource, LeaderboardUserData } from '../models/leaderboard';
import { ExtendedXCookieData, UserWallet, XCookieSource } from '../models/user';
import { GET_SEASON_0_PLAYER_LEVEL, GET_SEASON_0_PLAYER_LEVEL_REWARDS, GET_SEASON_0_REFERRAL_REWARDS } from '../utils/constants/user';
import { getUserCurrentPoints } from './leaderboard';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { updatePointsInContract } from './web3';
import { updateReferredUsersData } from './user';

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
        console.error('(generateStarterCodes)', err.message);
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

        // check if the user update operations included a level up
        const setUserLevel = userUpdateOperations.$set['inGameData.level'];

        // if the user just reached level 3 or 4, give 5 xCookies to the referrer
        if (setUserLevel && (setUserLevel === 3 || setUserLevel === 4)) {
            const referrerId: string | null = user.inviteCodeData.referrerId;

            if (referrerId) {
                // add the rewards to the referrer's `referralData.claimableReferralRewards.xCookies`.
                const referrer = await UserModel.findOne({ _id: referrerId }).lean();

                // only continue if the referrer exists
                if (referrer) {
                    await UserModel.updateOne({ _id: referrerId }, {
                        $inc: {
                            'referralData.claimableReferralRewards.xCookies': 5
                        }
                    })
                }
            }
        }

        // if it included a level, check if it's set to 5.
        // if it is, check if the user has a referrer.
        // the referrer will then have this user's `hasReachedLevel4` set to true.
        // NOTE: naming is `hasReachedLevel4`, but users are required to be level 5 anyway. this is temporary.
        if (setUserLevel && setUserLevel === 5) {
            // check if the user has a referrer
            const referrerId: string | null = user.inviteCodeData.referrerId;

            if (referrerId) {
                // update the referrer's referred users data where applicable
                const { status, message } = await updateReferredUsersData(referrerId, user._id);

                if (status === Status.ERROR) {
                    return {
                        status,
                        message: `(claimDailyRewards) Err from updateReferredUsersData: ${message}`,
                    };
                }
            }
        }

        // update the user's points in the wonderbits contract
        updatePointsInContract(twitterId);

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

/**
 * Gets the KOS count of each referred user the user has referred.
 */
export const getReferredUsersKOSCount = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getReferredUsersKOSCount) User not found.`
            }
        }

        // get the referredUsersData in `user.referralData`
        const referredUsersData = user?.referralData.referredUsersData as ReferredUserData[];

        const kosCountData: Array<{
            userId: string;
            kosCount: number;
        }> = [];

        if (referredUsersData.length === 0) {
            return {
                status: Status.SUCCESS,
                message: `(getReferredUsersKOSCount) No referred users found.`,
                data: {
                    kosCountData
                }
            }
        }

        for (const referredUserData of referredUsersData) {
            const referredUser = await UserModel.findOne({ _id: referredUserData.userId }).lean();

            if (!referredUser) {
                continue;
            }

            kosCountData.push({
                userId: referredUser._id,
                kosCount: referredUser.inGameData.kosCount
            });
        }

        return {
            status: Status.SUCCESS,
            message: `(getReferredUsersKOSCount) Referred users' KOS count retrieved.`,
            data: {
                kosCountData
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getReferredUsersKOSCount) ${err.message}`
        }
    }
}

/**
 * Updates the successful indirect referrals of each user (if applicable).
 * 
 * This requires the referred users to reach Level 4 first before counting the indirect referrals (i.e. the referrals from each referred user).
 * 
 * For example, User A refers User B. User B refers User C, D and E. If C, D and E have reached Level 4 but User B hasn't, then User A won't get the rewards.
 */
export const updateSuccessfulIndirectReferrals = async (): Promise<void> => {
    try {
        const users = await UserModel.find().lean();

        if (!users || users.length === 0) {
            return;
        }

        // get the successful indirect referrals
        const successfulIndirectReferrals = await SuccessfulIndirectReferralModel.find().lean();

        // an array to update existing entries in `successfulIndirectReferrals`
        const successfulIndirectReferralsUpdateOperations: Array<{
            userId: string;
            updateOperations: {
                $set: {
                };
                $push: {};
                $inc: {};
                $pull: {};
            }
        }> = [];

        // a promise array for adding new entries to `successfulIndirectReferrals`
        const successfulIndirectReferralsNewEntries = [];

        // loop through each user.
        // check if they have referred users that have reached level 4. if none, skip this user.
        // if they have, check if these referred users have referred users that have reached level 4.
        // if they have, check if the main user already has an entry in `successfulIndirectReferrals`.
        // if they don't, create a new entry.
        // if they do, skip the existing entries and only add new indirect referrals.
        users.map(user => {
            // get the users the user has referred
            const referredUsersData = (user?.referralData as ReferralData)?.referredUsersData ?? [];

            if (!referredUsersData || referredUsersData.length === 0) {
                return;
            }

            // if the user has no referred users OR all referred users have not reached level 4, skip this user.
            // to check if the referred users have reached level 4, we filter the referred users by `hasReachedLevel4`.
            const referredUsersReachedLevel4 = referredUsersData.filter(referredUserData => referredUserData.hasReachedLevel4);

            if (referredUsersReachedLevel4.length === 0) {
                return;
            }

            // create the `indirectReferralData` array for the user.
            // this essentially loops through all of the referred users of User A that have reached level 4.
            // then, it checks for any referred users of the referred users of User A that have reached level 4.
            const indirectReferralData: IndirectReferralData[] = referredUsersReachedLevel4.map(successfulReferredUserData => {
                // get this referred user's user instance
                const referredUser = users.find(u => u._id === successfulReferredUserData.userId);

                if (!referredUser) {
                    return {
                        obtainedRewardMilestone: 0,
                        claimableRewardData: {
                            userCountMilestone: 0,
                            xCookies: 0,
                            leaderboardPoints: 0
                        },
                        referredUserId: successfulReferredUserData.userId,
                        indirectReferredUserIds: []
                    }
                }

                // get the referred user's referred users data.
                // this will be the main user's indirect referrals.
                const indirectReferredUserData = (referredUser?.referralData as ReferralData).referredUsersData;

                if (!indirectReferredUserData || indirectReferredUserData.length === 0) {
                    return {
                        obtainedRewardMilestone: 0,
                        claimableRewardData: {
                            userCountMilestone: 0,
                            xCookies: 0,
                            leaderboardPoints: 0
                        },
                        referredUserId: successfulReferredUserData.userId,
                        indirectReferredUserIds: []
                    }
                }

                // filter these indirect referred users by `hasReachedLevel4`
                const indirectUsersReachedLevel4 = indirectReferredUserData.filter(data => data.hasReachedLevel4);

                if (indirectUsersReachedLevel4.length === 0) {
                    return {
                        obtainedRewardMilestone: 0,
                        claimableRewardData: {
                            userCountMilestone: 0,
                            xCookies: 0,
                            leaderboardPoints: 0
                        },
                        referredUserId: successfulReferredUserData.userId,
                        indirectReferredUserIds: []
                    }
                }

                console.log(`User ${user.twitterUsername} has ${indirectUsersReachedLevel4.length} indirect referred users that have reached level 4.`);

                // get the indirect referred users' user IDs
                const indirectReferredUserIds = indirectUsersReachedLevel4.map(data => data.userId);

                // firstly, check if the main user already has an entry in `successfulIndirectReferrals` for this referred user.
                const existingIndirectReferralData = successfulIndirectReferrals.find(data => data.userId === user._id)?.indirectReferralData.find(data => data.referredUserId === successfulReferredUserData.userId) as IndirectReferralData;

                // hard-coded milestones for the referral rewards. may need to change this to be dynamic later.
                const milestones = [1, 3, 5, 10, 20, 50, 100, 200, 300, 500];

                // if found, update the required parameters if necessary.
                // this includes the `claimableRewardData` if the main user now has more indirect referrals because of the referred user.
                // this also includes the `indirectReferredUserIDs`.
                if (existingIndirectReferralData) {
                    // get the previous `claimableRewardData`
                    const claimableRewardData = existingIndirectReferralData.claimableRewardData;

                    // check if there are any milestones skipped. if so, accumulate the rewards.
                    // for example, let's say, previously, the referred user has successfully referred 3 users. the main user gets 25% of the rewards for 3 indirect referrals.
                    // now, the referred user has successfully referred 10 users. that means that the user will get the rewards for 5 and 10 indirect referrals.
                    // we now check for the highest milestone (between userCountMilestone and obtainedRewardMilestone).
                    // the reason for this is because if we only check for `obtainedRewardMilestone`, it only gets updated once the user has claimed the rewards from a specific milestone, which is set as `userCountMilestone`.
                    // however, after claiming, `userCountMilestone` will be set back to 0 again, meaning that if we only check `userCountMilestone`, then it will essentially act as if the prev milestone is 0 and give the users all the rewards again.
                    // there can be a time where the user just earned rewards for a new milestone and haven't claimed it yet.
                    // there can be also a time when the user just claimed the rewards for a milestone and the `obtainedRewardMilestone` is updated, but the `userCountMilestone` is updated to 0 again.
                    // hence, we check the highest milestone between the two.
                    const highestMilestone = Math.max(existingIndirectReferralData.claimableRewardData.userCountMilestone, existingIndirectReferralData.obtainedRewardMilestone);
                    const skippedAndNewMilestones = milestones.filter(milestone => milestone > highestMilestone && milestone <= indirectReferredUserIds.length);

                    let skippedAndNewXCookies = 0;
                    let skippedAndNewLeaderboardPoints = 0;

                    // for each skipped milestone, increment the `skippedAndNewXCookies` and `skippedAndNewLeaderboardPoints` by the rewards for that milestone.
                    skippedAndNewMilestones.forEach(milestone => {
                        const milestoneRewards = GET_SEASON_0_REFERRAL_REWARDS(milestone);

                        skippedAndNewXCookies += (0.2 * milestoneRewards.xCookies);
                        skippedAndNewLeaderboardPoints += (0.2 * milestoneRewards.leaderboardPoints);
                    });

                    // reverse the milestones and check the first milestone that is less than or equal to the indirect referred user count.
                    // for example, if the `indirectReferredUserIds` length is 8, return 5, which is the nearest milestone from 8 less than the length.
                    const userCountMilestone = milestones.slice().reverse().find(milestone => milestone <= indirectReferredUserIds.length) || 0;

                    console.log('user count milestone from existing indirect referral data: ', userCountMilestone);

                    return {
                        // `obtainedRewardMilestone` will only be updated if the user has claimed the reward data for that milestone.
                        obtainedRewardMilestone: existingIndirectReferralData.obtainedRewardMilestone,
                        claimableRewardData: {
                            userCountMilestone,
                            xCookies: claimableRewardData.xCookies + skippedAndNewXCookies,
                            leaderboardPoints: claimableRewardData.leaderboardPoints + skippedAndNewLeaderboardPoints
                        },
                        referredUserId: successfulReferredUserData.userId,
                        indirectReferredUserIds
                    }
                // if not found, we create a new entry.
                } else {
                    const rewards = GET_SEASON_0_REFERRAL_REWARDS(indirectReferredUserIds.length);
                    const userCountMilestone = milestones.find(milestone => milestone >= indirectReferredUserIds.length) || 0;

                    console.log('user count milestone from nonexisting indirect referral data: ', userCountMilestone);

                    return {
                        obtainedRewardMilestone: 0,
                        claimableRewardData: {
                            userCountMilestone,
                            xCookies: (0.2 * rewards.xCookies),
                            leaderboardPoints: (0.2 * rewards.leaderboardPoints)
                        },
                        referredUserId: successfulReferredUserData.userId,
                        indirectReferredUserIds
                    }
                }
            })

            // if there are no indirect referrals, skip this user.
            if (indirectReferralData.length === 0) {
                return;
            }

            // check if the user already has an entry in `successfulIndirectReferrals`.
            // if they do, update the entire `indirectReferralData` array. based on the logic above, any overrides should be safe because it takes into account the previous data.
            // if they don't, create a new entry.
            const existingIndirectReferral = successfulIndirectReferrals.find(data => data.userId === user._id);

            if (existingIndirectReferral) {
                successfulIndirectReferralsUpdateOperations.push({
                    userId: user._id,
                    updateOperations: {
                        $set: {
                            indirectReferralData
                        },
                        $push: {},
                        $inc: {},
                        $pull: {}
                    }
                });
            } else {
                // create a new entry for the user and add it to the `successfullIndirectReferralsNewEntries` array to be Promise.all'ed later.
                successfulIndirectReferralsNewEntries.push(SuccessfulIndirectReferralModel.create({
                    _id: generateObjectId(),
                    userId: user._id,
                    indirectReferralData
                }));
            }
        });

        const updatePromises = successfulIndirectReferralsUpdateOperations.map(async op => {
            return SuccessfulIndirectReferralModel.updateOne({ userId: op.userId }, op.updateOperations);
        })

        console.log('create entries: ', successfulIndirectReferralsNewEntries);
        console.log('update entries: ', updatePromises);

        console.log(`(updateSuccessfulIndirectReferrals) Updating ${updatePromises.length} existing entries.`);
        console.log(`(updateSuccessfulIndirectReferrals) Creating ${successfulIndirectReferralsNewEntries.length} new entries.`);

        // execute the create operations and then the update operations
        await Promise.all(successfulIndirectReferralsNewEntries);
        await Promise.all(updatePromises);
    } catch (err: any) {
        console.log('(updateSuccessfulIndirectReferrals)', err.message);
    }
}


/**
 * Fetches the rewards that are claimable from indirect referrals.
 */
export const fetchSuccessfulIndirectReferralRewards = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(fetchSuccessfulIndirectReferralRewards) User not found.`
            }
        }

        // get the user ID
        const userId = user._id;

        // get the successful indirect referral with this user id
        const successfulIndirectReferral = await SuccessfulIndirectReferralModel.findOne({ userId }).lean();

        if (!successfulIndirectReferral) {
            return {
                status: Status.SUCCESS,
                message: `(fetchSuccessfulIndirectReferralRewards) No successful indirect referral data found.`,
                data: {
                    claimableRewardData: {
                        xCookies: 0,
                        leaderboardPoints: 0
                    }
                }
            }
        }

        // get the `indirectReferralData` array
        const indirectReferralData = successfulIndirectReferral.indirectReferralData as IndirectReferralData[];

        let claimableXCookies = 0;
        let claimablePoints = 0;

        // for each instance, fetch the `claimableRewardData` and add them up.
        for (const data of indirectReferralData) {
            claimableXCookies += data.claimableRewardData.xCookies;
            claimablePoints = data.claimableRewardData.leaderboardPoints;
        }

        return {
            status: Status.SUCCESS,
            message: `(fetchSuccessfulIndirectReferralRewards) Claimable rewards fetched.`,
            data: {
                claimableRewardData: {
                    xCookies: claimableXCookies,
                    leaderboardPoints: claimablePoints
                }
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(fetchSuccessfulIndirectReferralRewards) ${err.message}`
        }
    }
}

/**
 * Claims the rewards obtained from indirect referrals.
 */
export const claimSuccessfulIndirectReferralRewards = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimSuccessfulIndirectReferralRewards) User not found.`
            }
        }

        // get the user ID
        const userId = user._id;

        // get the successful indirect referral with this user id
        const successfulIndirectReferral = await SuccessfulIndirectReferralModel.findOne({ userId }).lean();

        if (!successfulIndirectReferral) {
            return {
                status: Status.SUCCESS,
                message: `(claimSuccessfulIndirectReferralRewards) No successful indirect referral data found.`,
                data: {
                    claimableRewardData: {
                        xCookies: 0,
                        leaderboardPoints: 0
                    }
                }
            }
        }

        const indirectRefUpdateOperations = {
            $set: {},
            $push: {},
            $inc: {},
            $pull: {}
        }

        const userRefUpdateOperations = {
            $set: {},
            $push: {},
            $inc: {},
            $pull: {}
        }

        // get the `indirectReferralData` array
        const indirectReferralData = successfulIndirectReferral.indirectReferralData as IndirectReferralData[];

        let claimableXCookies = 0;
        let claimablePoints = 0;

        // loop through each data
        for (const data of indirectReferralData) {
            // sum up the rewards
            claimableXCookies += data.claimableRewardData.xCookies;
            claimablePoints += data.claimableRewardData.leaderboardPoints;

            // do these things:
            // 1. make the `obtainedRewardMilestone` to the `data.claimableRewardData.userCountMilestone`
            // 2. set the `data.claimableRewardData.userCountMilestone` to 0
            // 3. reset the xCookies and leaderboardPoints to 0.
            const userCountMilestone = data.claimableRewardData.userCountMilestone;

            const dataIndex = indirectReferralData.findIndex(d => d.referredUserId === data.referredUserId);

            indirectRefUpdateOperations.$set[`indirectReferralData.${dataIndex}.obtainedRewardMilestone`] = userCountMilestone;
            indirectRefUpdateOperations.$set[`indirectReferralData.${dataIndex}.claimableRewardData.userCountMilestone`] = 0;
            indirectRefUpdateOperations.$set[`indirectReferralData.${dataIndex}.claimableRewardData.xCookies`] = 0;
            indirectRefUpdateOperations.$set[`indirectReferralData.${dataIndex}.claimableRewardData.leaderboardPoints`] = 0;
        }

        // add the rewards to the user's inventory and leaderboard points
        if (claimableXCookies > 0) {
            userRefUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = claimableXCookies;

            const indirectRefRewardsIndex = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(data => data.source === XCookieSource.INDIRECT_REFERRAL_REWARDS);

            if (indirectRefRewardsIndex !== -1) {
                userRefUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${indirectRefRewardsIndex}.xCookies`] = claimableXCookies;
            } else {
                userRefUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = {
                    xCookies: claimableXCookies,
                    source: XCookieSource.INDIRECT_REFERRAL_REWARDS,
                }
            }
        }

        if (claimablePoints > 0) {
            // because we don't expect this for now (rewards don't contain leaderboard points); return an error.
            return {
                status: Status.ERROR,
                message: `(claimSuccessfulIndirectReferralRewards) Claiming leaderboard points is not supported for now.`
            }
        }

        // execute the update operations. to double check, we run the operation for the user first, then the indirect referral data.
        await UserModel.updateOne({ twitterId }, userRefUpdateOperations);
        await SuccessfulIndirectReferralModel.updateOne({ userId }, indirectRefUpdateOperations);

        console.log(`(claimSuccessfulIndirectReferralRewards) Rewards claimed for User ${user._id}.`);

        return {
            status: Status.SUCCESS,
            message: `(claimSuccessfulIndirectReferralRewards) Rewards claimed.`,
            data: {
                claimableRewardData: {
                    xCookies: claimableXCookies,
                    leaderboardPoints: claimablePoints
                }
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimSuccessfulIndirectReferralRewards) ${err.message}`
        }
    }
}