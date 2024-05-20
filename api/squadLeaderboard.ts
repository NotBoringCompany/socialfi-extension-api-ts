import { SquadRank } from '../models/squad';
import { SquadLeaderboardModel, SquadModel } from '../utils/constants/db';
import { GET_SQUAD_WEEKLY_RANKING } from '../utils/constants/squadLeaderboard';
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
 * Gets called around every Sunday 23:59 UTC by a scheduler, just before a new squad leaderboard is created.
 */
export const calculateWeeklySquadRanking = async (): Promise<void> => {
    try {
        const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 });

        // if no leaderboard exists, return
        if (!latestSquadLeaderboard) {
            console.log('(calculateWeeklySquadRanking) No squad leaderboard found.');
            return;
        }

        const squads = await SquadModel.find();

        if (squads.length === 0 || !squads) {
            console.log('(calculateWeeklySquadRanking) No squads found.');
            return;
        }

        // prepare bulk write operations to update all squads' ranks
        const bulkWriteOperations = squads.map((squad) => {
            let updateOperations = [];

            // find the squad in the latest squad leaderboard
            const squadInLeaderboard = latestSquadLeaderboard.pointsData.find((squadData) => squadData.squadId === squad._id);

            // if the squad is not in the leaderboard, add the new SquadRankingData instance with a rank of `UNRANKED`
            if (!squadInLeaderboard) {
                updateOperations.push({
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

                updateOperations.push({
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
            }

            return updateOperations;
        }).flat();

        // execute the bulk write operations
        await SquadModel.bulkWrite(bulkWriteOperations);

        console.log('(calculateWeeklySquadRanking) Successfully calculated weekly squad rankings.');
    } catch (err: any) {
        console.error('Error in calculateWeeklySquadRanking:', err.message);
    }
}