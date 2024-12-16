import { ClientSession } from 'mongoose';
import { LeaderboardModel, SquadLeaderboardModel, SquadModel, TEST_CONNECTION, UserLeaderboardDataModel, UserModel } from '../utils/constants/db';
import { ReturnValue, Status } from '../utils/retVal';
import { GET_SEASON_0_PLAYER_LEVEL, GET_SEASON_0_PLAYER_LEVEL_REWARDS } from '../utils/constants/user';
import { InGameData, PointsData, PointsSource } from '../models/user';
import { CURRENT_SEASON } from '../utils/constants/leaderboard';

/**
 * Migrates all data from Leaderboard to UserLeaderboardData.
 */
export const migrateLeaderboardData = async (): Promise<void> => {
    try {
        // for now, there is only 1 season
        const leaderboard = await LeaderboardModel.findOne({ name: 'Season 0' }).lean();

        if (!leaderboard) {
            throw new Error('Leaderboard not found.');
        }

        // create an array of UserLeaderboardData instances
        const userLeaderboardDataArray = [];

        // for each user data, we create a new UserLeaderboardData instance
        for (const userData of leaderboard.userData) {
            const user = await UserModel.findOne({ _id: userData.userId }).lean();

            if (!user) {
                console.log(`(migrateLeaderboardData) User not found for userId: ${userData.userId}`);
                // skip
                continue;
            }

            // create the UserLeaderboardData instance
            const userLeaderboardData = {
                userId: userData.userId,
                username: userData.username,
                twitterProfilePicture: userData.twitterProfilePicture,
                season: 0,
                points: userData.pointsData.reduce((acc, data) => acc + data.points, 0),
            };

            userLeaderboardDataArray.push(userLeaderboardData);
        }

        // add the user leaderboard data to the `UserLeaderboardData` collection
        await UserLeaderboardDataModel.insertMany(userLeaderboardDataArray);

        // delete the leaderboard data
        await LeaderboardModel.deleteOne({ name: 'Season 0' });

        console.log('(migrateLeaderboardData) Data migrated successfully.');
    } catch (err: any) {
        console.error(`(migrateLeaderboardData) ${err.message}`);
    }
}

/**
 * Adds the user's points data to the user's inventory.
 */
export const addUserPointsToInventory = async (): Promise<void> => {
    try {
        const leaderboardData = await LeaderboardModel.findOne({ name: 'Season 0' }).lean();

        if (!leaderboardData) {
            throw new Error('Leaderboard data not found.');
        }

        const users = await UserModel.find().lean();

        // for each user, we set the pointsData.
        const userUpdateOperations: Array<{
            userId: string;
            updateOperations: {
                $set: {}
            }
        }> = [];

        for (const user of users) {
            const userData = leaderboardData.userData.find((data) => data.userId === user._id);

            if (!userData) {
                // create a new pointsData structure
                const pointsData: PointsData = {
                    currentPoints: 0,
                    totalPointsSpent: 0,
                    weeklyPointsSpent: 0,
                    extendedPointsData: []
                }

                userUpdateOperations.push({
                    userId: user._id,
                    updateOperations: {
                        $set: {
                            'inventory.pointsData': pointsData
                        }
                    }
                });
            }

            const pointsData: PointsData = {
                currentPoints: userData.pointsData.reduce((acc, data) => acc + data.points, 0),
                totalPointsSpent: 0,
                weeklyPointsSpent: 0,
                extendedPointsData: userData.pointsData.map((pd) => ({
                    points: pd.points,
                    source: pd.source as PointsSource,
                }))
            }

            userUpdateOperations.push({
                userId: user._id,
                updateOperations: {
                    $set: {
                        'inventory.pointsData': pointsData
                    }
                }
            });
        }

        console.log(`(addUserPointsToInventory) userUpdateOperations: ${JSON.stringify(userUpdateOperations, null, 2)}`);

        // perform the update operations
        const promises = userUpdateOperations.map(async ({ userId, updateOperations }) => {
            await UserModel.updateOne({ _id: userId }, updateOperations);
        })

        await Promise.all(promises);

        console.log('(addUserPointsToInventory) Data updated successfully.');
    } catch (err: any) {
        console.error(`(addUserPointsToInventory) ${err.message}`);
    }
}

/**
 * Gets a leaderboard's rankings for users of a specific season.
 * 
 * Sorts the user data by points in descending order.
 */
export const getLeaderboardRanking = async (season: number): Promise<ReturnValue> => {
    try {
        // fetch all the data from UserLeaderboardData for the current season
        const leaderboardData = await UserLeaderboardDataModel.find({ season }).lean();

        if (!leaderboardData || leaderboardData.length === 0) {
            return {
                status: Status.ERROR,
                message: `(getLeaderboardRanking) Leaderboard for season ${season} not found.`
            };
        }

        // Sort the user data by points in descending order
        const descendingPoints = leaderboardData.sort((a, b) => {
            return b.points - a.points;
        });

        // Add a rank to each user data
        const rankedUserData = descendingPoints.map((userData, index) => ({
            rank: index + 1,
            userId: userData.userId,
            username: userData.username,
            twitterProfilePicture: userData.twitterProfilePicture,
            points: userData.points,
        }));

        return {
            status: Status.SUCCESS,
            message: `(getLeaderboardRanking) Leaderboard found.`,
            data: {
                ranking: rankedUserData
            }
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getLeaderboardRanking) ${err.message}`
        }
    }
}

/**
 * (User) Gets the user's own ranking in a leaderboard.
 */
export const getOwnLeaderboardRanking = async (
    twitterId: string,
    season: number,
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getOwnLeaderboardRanking) User not found.`
            };
        }

        const leaderboardData = await UserLeaderboardDataModel.find({ season }).lean();

        if (!leaderboardData || leaderboardData.length === 0) {
            return {
                status: Status.ERROR,
                message: `(getOwnLeaderboardRanking) Leaderboard for season ${season} not found.`
            };
        }

        // Sort the user data by points in descending order
        const descendingPoints = leaderboardData.sort((a, b) => {
            return b.points - a.points;
        });

        // Find the user's data and determine the rank simultaneously
        let userRank = -1; // Default value indicating not found

        const userData = descendingPoints.find((data, index) => {
            if (data.userId === user._id.toString()) {
                userRank = index + 1; // Adjust for zero-based index
                return true;
            }
            return false;
        });

        if (!userData || userRank === -1) {
            return {
                status: Status.ERROR,
                message: `(getOwnLeaderboardRanking) User data not found in leaderboard.`
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getOwnLeaderboardRanking) User data found.`,
            data: {
                ranking: {
                    rank: userRank,
                    userId: user._id,
                    username: user.twitterUsername,
                    twitterId: user.twitterId,
                    twitterProfilePicture: userData.twitterProfilePicture,
                    points: userData.points,
                    pointsData: user.inventory.pointsData
                }
            }
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getOwnLeaderboardRanking) ${err.message}`
        }
    }
}

/**
 * Add a user's leaderboard points, also updates the points from the squad leaderboard (for the current season).
 */
export const addPoints = async (
    userId: string, 
    pointsData: {
        points: number,
        source: PointsSource
    },
    _session?: ClientSession
): Promise<ReturnValue> => {
    const session = _session ?? (await TEST_CONNECTION.startSession());
    if (!_session) session.startTransaction();

    try {
        const user = await UserModel.findOne({ $or: [{ _id: userId }, { twitterId: userId }] }).lean();

        if (!user) {
            throw new Error('User not found.');
        }

        const userUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {}
        }

        const userLeaderboardDataUpdateOperations = {
            $inc: {},
            $set: {},
            $push: {}
        }

        const userLeaderboardData = await UserLeaderboardDataModel.findOne({ userId, season: CURRENT_SEASON }).lean();
        
        if (!userLeaderboardData) {
            // if user leaderboard doesn't exist, we create a new entry.
            // check if the user is eligible to level up to the next level
            const newLevel = GET_SEASON_0_PLAYER_LEVEL(pointsData.points);

            // set the user's `inGameData.level` to the new level
            if (newLevel > user.inGameData.level) {
                userUpdateOperations.$set['inGameData.level'] = newLevel;
            }

            // TEMPORARY DISABLE THE ADDITIONAL POINTS SYSTEM!!!
            // // add the additional points based on the rewards obtainable
            // const additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);

            // create a new entry for the user leaderboard data
            await UserLeaderboardDataModel.create([{
                userId: user._id,
                username: user.twitterUsername,
                twitterProfilePicture: user.twitterProfilePicture,
                season: CURRENT_SEASON,
                points: pointsData.points,
            }], { session });
        } else {
            // check if the user is eligible to level up to the next level
            const newLevel = GET_SEASON_0_PLAYER_LEVEL(userLeaderboardData.points + pointsData.points);

            // set the user's `inGameData.level` to the new level
            if (newLevel > user.inGameData.level) {
                userUpdateOperations.$set['inGameData.level'] = newLevel;
            }

            // TEMPORARY DISABLE THE ADDITIONAL POINTS SYSTEM!!!
            // // add the additional points based on the rewards obtainable
            // const additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);

            // update the user leaderboard data
            userLeaderboardDataUpdateOperations.$inc['points'] = pointsData.points;
        }

        // update the user's points data.
        if (user?.inventory?.pointsData) {
            // add the points to the user's `currentPoints`
            userUpdateOperations.$inc['inventory.pointsData.currentPoints'] = pointsData.points;
            
            // check if the source already exists in the user's points data
            // if not, we add a new entry
            const sourceIndex = (user.inventory.pointsData as PointsData).extendedPointsData.findIndex((data) => data.source === pointsData.source);

            if (sourceIndex !== -1) {
                userUpdateOperations.$inc[`inventory.pointsData.extendedPointsData.${sourceIndex}.points`] = pointsData.points;
            } else {
                userUpdateOperations.$push['inventory.pointsData.extendedPointsData'] = {
                    points: pointsData.points,
                    source: pointsData.source
                }
            }
        } else {
            // create a new points data structure
            userUpdateOperations.$set['inventory.pointsData'] = {
                currentPoints: pointsData.points,
                totalPointsSpent: 0,
                weeklyPointsSpent: 0,
                extendedPointsData: [{
                    points: pointsData.points,
                    source: pointsData.source
                }]
            }
        }

        // if the user also has a squad, add the points to the squad's total points
        if (user.inGameData.squad !== null) {
            // get the squad
            const squad = await SquadModel.findOne({ _id: user.inGameData.squadId });
            if (!squad) {
                throw new Error('Squad not found');
            }

            const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 });

            // add only the points to the squad's total points
            await squad.updateOne({
                $inc: {
                    [`squadPoints`]: pointsData.points
                }
            });

            // check if the squad exists in the squad leaderboard's `pointsData`. if not, we create a new instance.
            const squadIndex = latestSquadLeaderboard.pointsData.findIndex((data) => data.squadId === squad._id);

            if (squadIndex === -1) {
                await latestSquadLeaderboard.updateOne({
                    $push: {
                        'pointsData': {
                            squadId: squad._id,
                            squadName: squad.name,
                            memberPoints: [
                                {
                                    userId: user._id,
                                    username: user.twitterUsername,
                                    points: pointsData.points,
                                },
                            ],
                        }
                    }
                });
            } else {
                // otherwise, we increment the points for the user in the squad
                const userIndex = latestSquadLeaderboard.pointsData[squadIndex].memberPoints.findIndex(
                    (member) => member.userId === user._id
                );

                if (userIndex !== -1) {
                    await latestSquadLeaderboard.updateOne({
                        $inc: {
                            [`pointsData.${squadIndex}.memberPoints.${userIndex}.points`]: pointsData.points
                        }
                    });
                } else {
                    await latestSquadLeaderboard.updateOne({
                        $push: {
                            [`pointsData.${squadIndex}.memberPoints`]: {
                                userId: user._id,
                                username: user.twitterUsername,
                                points: pointsData.points,
                            }
                        }
                    });
                }
            }
        }

        // commit the transaction only if this function started it
        if (!_session) {
            await session.commitTransaction();
            session.endSession();
        }

        return {
            status: Status.SUCCESS,
            message: `(addItem) Item added to the inventory successfully`,
        };
    } catch (err: any) {
        // abort the transaction if an error occurs
        if (!_session) {
            await session.abortTransaction();
            session.endSession();
        }

        return {
            status: Status.ERROR,
            message: `(addItem) ${err.message}`,
        };
    }
}
