import mongoose from 'mongoose';
import { Food } from '../models/food';
import { Item } from '../models/item';
import { SquadRank, SquadRole } from '../models/squad';
import { SquadReward, SquadRewardType } from '../models/squadLeaderboard';
import { SquadLeaderboardModel, SquadMemberClaimableWeeklyRewardModel, SquadModel, UserModel } from '../utils/constants/db';
import { GET_SQUAD_WEEKLY_RANKING, GET_SQUAD_WEEKLY_RANKING_REWARDS } from '../utils/constants/squadLeaderboard';
import { ReturnValue, Status } from '../utils/retVal';
import * as dotenv from 'dotenv';
import { generateObjectId } from '../utils/crypto';

dotenv.config();

/**
 * Creates a new squad leaderboard each week at Sunday 23:59 UTC. Called by a scheduler.
 */
export const addSquadLeaderboard = async (): Promise<void> => {
    try {
        // get the latest week number
        const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 });

        // if no leaderboard exists, create a new one
        if (!latestSquadLeaderboard) {
            await SquadLeaderboardModel.create({
                week: 1,
                pointsData: []
            });
            
            console.log('Created a new squad leaderboard for week 1.');
            return;
        // otherwise, get the latest week number and create a new leaderboard
        } else {
            await SquadLeaderboardModel.create({
                week: latestSquadLeaderboard.week + 1,
                pointsData: []
            });

            console.log(`Created a new squad leaderboard for week ${latestSquadLeaderboard.week + 1}.`);
            return;
        }
    } catch (err: any) {
        console.error('Error in addSquadLeaderboard:', err.message);
    }
}

/**
 * Gets the latest weekly squad leaderboard.
 */
export const getLatestWeeklyLeaderboard = async (): Promise<ReturnValue> => {
    try {
        const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 });

        // if no leaderboard exists, return
        if (!latestSquadLeaderboard) {
            return {
                status: Status.ERROR,
                message: 'No squad leaderboard found.'
            }
        }

        return {
            status: Status.SUCCESS,
            message: 'Successfully retrieved the latest weekly squad leaderboard.',
            data: latestSquadLeaderboard
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getLatestWeeklyLeaderboard) ${err.message}`
        }
    }
}

/**
 * Calculates the points earned by each squad and assigns a rank to each squad. 
 * 
 * Also gives rewards to each member if they are eligible.
 * 
 * Gets called around every Sunday 23:59 UTC by a scheduler, just before a new squad leaderboard is created.
 */
export const calculateWeeklySquadRankingAndGiveRewards = async (): Promise<void> => {
    try {
        const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 });

        // if no leaderboard exists, return
        if (!latestSquadLeaderboard) {
            console.log('(calculateWeeklySquadRankingAndGiveRewards) No squad leaderboard found.');
            return;
        }

        const squads = await SquadModel.find().lean();

        if (squads.length === 0 || !squads) {
            console.log('(calculateWeeklySquadRankingAndGiveRewards) No squads found.');
            return;
        }

        const squadMemberClaimableWeeklyRewardsUpdateOperations: Array<{
            userId: string;
            updateOperations: {
                $set: {},
                $push: {},
                $inc: {}
                $pull: {}
            }
        }> = [];

        const squadUpdateOperations: Array<{
            squadId: string;
            updateOperations: {
                $set: {},
                $push: {},
                $inc: {}
                $pull: {}
            }
        }> = [];

        // prepare bulk write operations to update all squads' ranks
        squads.map(async (squad) => {
            // find the squad in the latest squad leaderboard
            const squadInLeaderboard = latestSquadLeaderboard.pointsData.find((squadData) => squadData.squadId === squad._id);

            // if the squad is not in the leaderboard, add the new SquadRankingData instance with a rank of `UNRANKED`
            if (!squadInLeaderboard) {
                squadUpdateOperations.push({
                    squadId: squad._id,
                    updateOperations: {
                        $set: {
                            squadRankingData: [{
                                week: latestSquadLeaderboard.week,
                                rank: SquadRank.UNRANKED
                            }]
                        },
                        $push: {},
                        $inc: {},
                        $pull: {}
                    }
                });
            // if the squad is in the leaderboard, calculate the points and assign a rank
            } else {
                // loop through the squad's `pointsData.memberPoints.points` in the leaderboard and sum them up
                const totalPoints = squadInLeaderboard.memberPoints.reduce((acc, memberPoints) => acc + memberPoints.points, 0);

                // assign a rank based on the total points
                const rank = GET_SQUAD_WEEKLY_RANKING(totalPoints);

                console.log(`rank of squad ${squad.name} is ${rank}.`);

                squadUpdateOperations.push({
                    squadId: squad._id,
                    updateOperations: {
                        $set: {},
                        $push: {
                            squadRankingData: {
                                week: latestSquadLeaderboard.week,
                                rank
                            }
                        },
                        $inc: {},
                        $pull: {}
                    }
                });

                // if the squad is eligible for rewards, add the rewards to each squad member (also the leader)
                const { leader: leaderRewards, member: memberRewards } = GET_SQUAD_WEEKLY_RANKING_REWARDS(rank);

                console.log(`leader rewards: ${leaderRewards}, member rewards: ${memberRewards}`);

                // fetch the leader and squad members from `SquadModel`
                const squadData = await SquadModel.findOne({ _id: squad._id }).lean();

                if (!squadData) {
                    console.log('(calculateWeeklySquadRankingAndGiveRewards) No squad data found.');
                    return;
                }

                // right now, theres only 1 leader possible, so we take the 0th index.
                const leader = squadData.members.filter((member) => member.role === SquadRole.LEADER)[0];
                const members = squadData.members.filter((member) => member.role === SquadRole.MEMBER);

                // get the squad member weekly rewards 
                const squadMemberClaimableWeeklyRewards = await SquadMemberClaimableWeeklyRewardModel.find().lean();

                console.log('leader rewards length: ', leaderRewards.length);
                console.log('member rewards length: ', memberRewards.length);

                // add the leader's rewards
                if (leaderRewards.length > 0) {
                    // check if the leader is already in the `squadMemberClaimableWeeklyRewards` array
                    // if not, add the leader to the array
                    // if they do, check, for each item, if the reward type already exists. If it does, add the amount to the existing reward.
                    const leaderIndex = squadMemberClaimableWeeklyRewards.findIndex((member) => member.userId === leader.userId);

                    if (leaderIndex === -1) {
                        // create a new SquadMemberClaimableWeeklyReward instance for the leader
                        await SquadMemberClaimableWeeklyRewardModel.create({
                            _id: generateObjectId(),
                            userId: leader.userId,
                            username: leader.username,
                            twitterProfilePicture: leader.twitterProfilePicture,
                            claimableRewards: leaderRewards
                        });

                        console.log(`(calculateWeeklySquadRankingAndGiveRewards) Created a new SquadMemberClaimableWeeklyReward instance for ${leader.username}.`);
                    } else {
                        leaderRewards.forEach((leaderReward) => {
                            const rewardIndex = squadMemberClaimableWeeklyRewards[leaderIndex].claimableRewards.findIndex((reward: SquadReward) => reward.type === leaderReward.type);

                            if (rewardIndex === -1) {
                                squadMemberClaimableWeeklyRewardsUpdateOperations.push({
                                    userId: leader.userId,
                                    updateOperations: {
                                        $push: {
                                            claimableRewards: leaderReward
                                        },
                                        $set: {},
                                        $inc: {},
                                        $pull: {}
                                    }
                                });
                            } else {
                                squadMemberClaimableWeeklyRewardsUpdateOperations.push({
                                    userId: leader.userId,
                                    updateOperations: {
                                        $inc: {
                                            [`claimableRewards.${rewardIndex}.amount`]: leaderReward.amount
                                        },
                                        $set: {},
                                        $push: {},
                                        $pull: {}
                                    }
                                });
                            }
                        });
                    }
                }

                // add the members' rewards
                if (memberRewards.length > 0) {
                    members.forEach(async (member) => {
                        // check if the member is already in the `squadMemberClaimableWeeklyRewards` array
                        // if not, add the member to the array
                        // if they do, check, for each item, if the reward type already exists. If it does, add the amount to the existing reward.
                        const memberIndex = squadMemberClaimableWeeklyRewards.findIndex((m) => m.userId === member.userId);

                        if (memberIndex === -1) {
                            // create a new SquadMemberClaimableWeeklyReward instance for the member
                            await SquadMemberClaimableWeeklyRewardModel.create({
                                _id: generateObjectId(),
                                userId: member.userId,
                                username: member.username,
                                twitterProfilePicture: member.twitterProfilePicture,
                                claimableRewards: memberRewards
                            });

                            console.log(`(calculateWeeklySquadRankingAndGiveRewards) Created a new SquadMemberClaimableWeeklyReward instance for ${member.username}.`);
                        } else {
                            memberRewards.forEach((memberReward) => {
                                const rewardIndex = squadMemberClaimableWeeklyRewards[memberIndex].claimableRewards.findIndex((reward: SquadReward) => reward.type === memberReward.type);

                                if (rewardIndex === -1) {
                                    squadMemberClaimableWeeklyRewardsUpdateOperations.push({
                                        userId: member.userId,
                                        updateOperations: {
                                            $push: {
                                                claimableRewards: memberReward
                                            },
                                            $set: {},
                                            $inc: {},
                                            $pull: {}
                                        }
                                    });
                                } else {
                                    squadMemberClaimableWeeklyRewardsUpdateOperations.push({
                                        userId: member.userId,
                                        updateOperations: {
                                            $inc: {
                                                [`claimableRewards.${rewardIndex}.amount`]: memberReward.amount
                                            },
                                            $set: {},
                                            $push: {},
                                            $pull: {}
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            }
        });

        console.log('squad member claimable weekly rewards update operations:', squadMemberClaimableWeeklyRewardsUpdateOperations);
        console.log('squad update operations:', squadUpdateOperations[0]);

        const squadMemberClaimableWeeklyRewardsUpdatePromises = 
            squadMemberClaimableWeeklyRewardsUpdateOperations.length > 0 && squadMemberClaimableWeeklyRewardsUpdateOperations.map(async op => {
                return SquadMemberClaimableWeeklyRewardModel.updateOne({ userId: op.userId }, op.updateOperations);
            });
        
        const squadUpdatePromises = 
            squadUpdateOperations.length > 0 && squadUpdateOperations.map(async op => {
                return SquadModel.updateOne({ _id: op.squadId }, op.updateOperations);
            });
        
        await Promise.all([
            squadMemberClaimableWeeklyRewardsUpdatePromises,
            squadUpdatePromises
        ]);

        console.log('(calculateWeeklySquadRankingAndGiveRewards) Successfully calculated weekly squad rankings and gave eligible rewards.');
    } catch (err: any) {
        console.error('Error in calculateWeeklySquadRankingAndGiveRewards:', err.message);
    }
}

/**
 * Claims the squad member rewards each week if they are eligible.
 */
export const claimWeeklySquadMemberRewards = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimWeeklySquadMemberRewards) User not found.`
            }
        }

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const squadMemberClaimableWeeklyRewards = await SquadMemberClaimableWeeklyRewardModel.findOne({ userId: user._id });

        if (!squadMemberClaimableWeeklyRewards) {
            return {
                status: Status.ERROR,
                message: `(claimWeeklySquadMemberRewards) User has no claimable squad rewards.`
            }
        }

        // claim the rewards
        const rewards = squadMemberClaimableWeeklyRewards.claimableRewards as SquadReward[];

        if (rewards.length === 0) {
            return {
                status: Status.ERROR,
                message: `(claimWeeklySquadMemberRewards) User has no claimable squad rewards.`
            }
        }

        // for each reward, add the reward to the user's inventory
        rewards.filter(reward => reward.amount > 0).map(reward => {
            // if reward type is Bit Orb (I)/(II)/(III), Terra Capsulator (I)/(II), Gathering Progress Booster 50, or Raft Speed Booster 3 Min
            // we will add the reward to the user's inventory's `items`.
            // if reward type is Burger, we will add the reward to the user's inventory's `food`.
            if (reward.type === 
                SquadRewardType.BIT_ORB_I || 
                reward.type === SquadRewardType.BIT_ORB_II || 
                reward.type === SquadRewardType.BIT_ORB_III || 
                reward.type === SquadRewardType.TERRA_CAPSULATOR_I || 
                reward.type === SquadRewardType.TERRA_CAPSULATOR_II || 
                reward.type === SquadRewardType.GATHERING_PROGRESS_BOOSTER_50 || 
                reward.type === SquadRewardType.RAFT_SPEED_BOOSTER_3_MIN
            ) {
                // check if the user's inventory's `items` already has the reward type.
                // if it does, add the amount to the existing reward. if not, add the reward to the user's inventory's `items`.
                const itemIndex = (user.inventory?.items as Item[]).findIndex(item => item.type === reward.type as string);

                if (itemIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.items.${itemIndex}.amount`] = reward.amount;
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
            }

            if (reward.type === SquadRewardType.BURGER) {
                // check if the user's inventory's `food` already has the reward type.
                // if it does, add the amount to the existing reward. if not, add the reward to the user's inventory's `food`.
                const foodIndex = (user.inventory?.foods as Food[]).findIndex((food) => food.type === reward.type as string);

                if (foodIndex === -1) {
                    if (!userUpdateOperations.$push['inventory.food']) {
                        userUpdateOperations.$push['inventory.food'] = {
                            $each: [],
                        };
                    }

                    userUpdateOperations.$push['inventory.food'].$each.push({
                        type: reward.type,
                        amount: reward.amount,
                    });
                } else {
                    userUpdateOperations.$inc[`inventory.food.${foodIndex}.amount`] = reward.amount;
                }
            }
        })

        // add the rewards to the user's inventory
        await UserModel.updateOne({ twitterId }, { $set: userUpdateOperations.$set, $inc: userUpdateOperations.$inc, $push: userUpdateOperations.$push, $pull: userUpdateOperations.$pull });

        // reset all the user's claimable rewards
        await SquadMemberClaimableWeeklyRewardModel.updateOne({ userId: user._id }, {
            claimableRewards: []
        });

        console.log(`(claimWeeklySquadMemberRewards) Successfully claimed weekly squad member rewards for ${user.twitterUsername}.`);

        return {
            status: Status.SUCCESS,
            message: 'Successfully claimed weekly squad member rewards.',
            data: {
                rewards
            }
        }

    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimWeeklySquadMemberRewards) ${err.message}`
        }
    }
}

/**
 * Fetches a user's claimable weekly squad member rewards.
 */
export const getClaimableWeeklySquadMemberRewards = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getClaimableWeeklySquadMemberRewards) User not found.`
            }
        }

        const squadMemberClaimableWeeklyRewards = await SquadMemberClaimableWeeklyRewardModel.findOne({ userId: user._id });

        if (!squadMemberClaimableWeeklyRewards) {
            return {
                status: Status.ERROR,
                message: `(getClaimableWeeklySquadMemberRewards) User has no claimable squad rewards.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: 'Successfully retrieved user\'s claimable weekly squad member rewards.',
            data: {
                rewards: squadMemberClaimableWeeklyRewards.claimableRewards
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getClaimableWeeklySquadMemberRewards) ${err.message}`
        }
    }
}