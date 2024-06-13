import { SquadRank, SquadRole } from '../models/squad';
import { SquadReward, SquadRewardType } from '../models/squadLeaderboard';
import { SquadLeaderboardModel, SquadMemberClaimableWeeklyRewardModel, SquadModel } from '../utils/constants/db';
import { GET_SQUAD_WEEKLY_RANKING, GET_SQUAD_WEEKLY_RANKING_REWARDS } from '../utils/constants/squadLeaderboard';
import { ReturnValue, Status } from '../utils/retVal';

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

        const squads = await SquadModel.find();

        if (squads.length === 0 || !squads) {
            console.log('(calculateWeeklySquadRankingAndGiveRewards) No squads found.');
            return;
        }

        // prepare bulk write operations to update all squads' ranks
        const bulkWriteOpsPromises = squads.map(async (squad) => {
            const squadUpdateOperations = [];
            const squadMemberWeeklyRewardOperations = [];

            // find the squad in the latest squad leaderboard
            const squadInLeaderboard = latestSquadLeaderboard.pointsData.find((squadData) => squadData.squadId === squad._id);

            // if the squad is not in the leaderboard, add the new SquadRankingData instance with a rank of `UNRANKED`
            if (!squadInLeaderboard) {
                squadUpdateOperations.push({
                    updateOne: {
                        filter: { _id: squad._id },
                        update: { 
                            $push: { 
                                rankingData: { 
                                    week: latestSquadLeaderboard.week, 
                                    rank: SquadRank.UNRANKED 
                                } 
                            } 
                        }
                    }
                });
            // if the squad is in the leaderboard, calculate the points and assign a rank
            } else {
                // loop through the squad's `pointsData.memberPoints.points` in the leaderboard and sum them up
                const totalPoints = squadInLeaderboard.memberPoints.reduce((acc, memberPoints) => acc + memberPoints.points, 0);

                // assign a rank based on the total points
                const rank = GET_SQUAD_WEEKLY_RANKING(totalPoints);

                squadUpdateOperations.push({
                    updateOne: {
                        filter: { _id: squad._id },
                        update: { 
                            $push: { 
                                rankingData: { 
                                    week: latestSquadLeaderboard.week, 
                                    rank 
                                } 
                            } 
                        }
                    }
                });

                // if the squad is eligible for rewards, add the rewards to each squad member (also the leader)
                const { leader: leaderRewards, member: memberRewards } = GET_SQUAD_WEEKLY_RANKING_REWARDS(rank);

                // fetch the leader and squad members from `SquadModel`
                const squadData = await SquadModel.findOne({ _id: squad._id });

                if (!squadData) {
                    console.log('(calculateWeeklySquadRankingAndGiveRewards) No squad data found.');
                    return;
                }

                // right now, theres only 1 leader possible, so we take the 0th index.
                const leader = squadData.members.filter((member) => member.role === SquadRole.LEADER)[0];
                const members = squadData.members.filter((member) => member.role === SquadRole.MEMBER);

                // get the squad member weekly rewards 
                const squadMemberClaimableWeeklyRewards = await SquadMemberClaimableWeeklyRewardModel.find();

                // add the leader's rewards
                if (leaderRewards.length > 0) {
                    // check if the leader is already in the `squadMemberClaimableWeeklyRewards` array
                    // if not, add the leader to the array
                    // if they do, check, for each item, if the reward type already exists. If it does, add the amount to the existing reward.
                    const leaderIndex = squadMemberClaimableWeeklyRewards.findIndex((member) => member.userId === leader.userId);

                    if (leaderIndex === -1) {
                        squadMemberWeeklyRewardOperations.push({
                            insertOne: {
                                document: {
                                    userId: leader.userId,
                                    username: leader.username,
                                    twitterProfilePicture: leader.twitterProfilePicture,
                                    claimableRewards: leaderRewards
                                }
                            }
                        });
                    } else {
                        leaderRewards.forEach((leaderReward) => {
                            const rewardIndex = squadMemberClaimableWeeklyRewards[leaderIndex].claimableRewards.findIndex((reward: SquadReward) => reward.type === leaderReward.type);

                            if (rewardIndex === -1) {
                                squadMemberWeeklyRewardOperations.push({
                                    updateOne: {
                                        filter: { userId: leader.userId },
                                        update: {
                                            $push: {
                                                claimableRewards: leaderReward
                                            }
                                        }
                                    }
                                });
                            } else {
                                squadMemberWeeklyRewardOperations.push({
                                    updateOne: {
                                        filter: { userId: leader.userId },
                                        update: {
                                            $inc: {
                                                [`claimableRewards.${rewardIndex}.amount`]: leaderReward.amount
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    }
                }

                // add the members' rewards
                if (memberRewards.length > 0) {
                    members.forEach((member) => {
                        // check if the member is already in the `squadMemberClaimableWeeklyRewards` array
                        // if not, add the member to the array
                        // if they do, check, for each item, if the reward type already exists. If it does, add the amount to the existing reward.
                        const memberIndex = squadMemberClaimableWeeklyRewards.findIndex((member) => member.userId === member.userId);

                        if (memberIndex === -1) {
                            squadMemberWeeklyRewardOperations.push({
                                insertOne: {
                                    document: {
                                        userId: member.userId,
                                        username: member.username,
                                        twitterProfilePicture: member.twitterProfilePicture,
                                        claimableRewards: memberRewards
                                    }
                                }
                            });
                        } else {
                            memberRewards.forEach((memberReward) => {
                                const rewardIndex = squadMemberClaimableWeeklyRewards[memberIndex].claimableRewards.findIndex((reward: SquadReward) => reward.type === memberReward.type);

                                if (rewardIndex === -1) {
                                    squadMemberWeeklyRewardOperations.push({
                                        updateOne: {
                                            filter: { userId: member.userId },
                                            update: {
                                                $push: {
                                                    claimableRewards: memberReward
                                                }
                                            }
                                        }
                                    });
                                } else {
                                    squadMemberWeeklyRewardOperations.push({
                                        updateOne: {
                                            filter: { userId: member.userId },
                                            update: {
                                                $inc: {
                                                    [`claimableRewards.${rewardIndex}.amount`]: memberReward.amount
                                                }
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            }

            return {
                squadUpdateOperations,
                squadMemberWeeklyRewardOperations
            };
        });

        const bulkWriteOperations = await Promise.all(bulkWriteOpsPromises);

        const squadUpdateOperations = bulkWriteOperations.map((bulkWriteOperation) => bulkWriteOperation.squadUpdateOperations).flat().filter(op => op !== undefined);
        const squadMemberWeeklyRewardOperations = bulkWriteOperations.map((bulkWriteOperation) => bulkWriteOperation.squadMemberWeeklyRewardOperations).flat().filter(op => op !== undefined);

        if (squadUpdateOperations.length === 0 && squadMemberWeeklyRewardOperations.length === 0) {
            console.log('(calculateWeeklySquadRankingAndGiveRewards) No squads to update.');
            return;
        }

        console.log('squad update operations from calculateWeeklySquadRankingAndGiveRewards:', squadUpdateOperations);
        console.log('squad member weekly reward operations from calculateWeeklySquadRankingAndGiveRewards:', squadMemberWeeklyRewardOperations);

        // execute the bulk write operations
        await SquadModel.bulkWrite(squadUpdateOperations);
        await SquadMemberClaimableWeeklyRewardModel.bulkWrite(squadMemberWeeklyRewardOperations);

        console.log('(calculateWeeklySquadRankingAndGiveRewards) Successfully calculated weekly squad rankings and gave eligible rewards.');
    } catch (err: any) {
        console.error('Error in calculateWeeklySquadRankingAndGiveRewards:', err.message);
    }
}