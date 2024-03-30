import { LeaderboardType } from '../models/leaderboard';
import { LeaderboardModel, UserModel } from '../utils/constants/db';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Adds a new leaderboard to the database. Only callable by admin.
 */
export const addLeaderboard = async (
    type: LeaderboardType,
    adminKey: string
): Promise<ReturnValue> => {
    if (adminKey !== process.env.ADMIN_KEY) {
        return {
            status: Status.UNAUTHORIZED,
            message: `(addLeaderboard) Admin key is incorrect.`
        }
    }
    try {
        // check if leaderboard with the same type already exists
        const leaderboardExists = await LeaderboardModel.exists({ type });

        if (leaderboardExists) {
            return {
                status: Status.ERROR,
                message: `(addLeaderboard) Leaderboard with the same type already exists.`
            }
        }

        const leaderboard = new LeaderboardModel({
            type: type,
            userData: []
        });

        await leaderboard.save();

        return {
            status: Status.SUCCESS,
            message: `(addLeaderboard) Leaderboard added.`,
            data: {
                leaderboard
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addLeaderboard) ${err.message}`
        }
    }
}

/**
 * Adds the user data from the weekly leaderboard to the main leaderboard.
 * 
 * Should be called by a scheduler weekly every Sunday 23:59 UTC.
 */
export const addWeeklyToMainLeaderboard = async (): Promise<void> => {
    try {
        // get both leaderboards
        const [weeklyLeaderboard, mainLeaderboard] = await Promise.all([
            LeaderboardModel.findOne({ type: LeaderboardType.WEEKLY }).lean(),
            LeaderboardModel.findOne({ type: LeaderboardType.MAIN }).lean()
        ]);

        if (!weeklyLeaderboard || !mainLeaderboard) {
            throw new Error(`(addWeeklyToMainLeaderboard) Leaderboards not found.`);
        }

        // for each user in the weekly leaderboard's user data:
        // 1. if the user is found in the main leaderboard, increment their points
        // 2. if the user is not found in the main leaderboard, create a new instance with the points they received in the weekly leaderboard
        const bulkWriteOperations = weeklyLeaderboard.userData.map(weeklyUserData => {
            let updateOperations = [];

            const userExists = mainLeaderboard.userData.find(user => user.userId === weeklyUserData.userId);

            if (userExists) {
                updateOperations.push({
                    updateOne: {
                        filter: { _id: mainLeaderboard._id, 'userData.userId': weeklyUserData.userId },
                        update: {
                            // TO DO: increment the points with a multiplier if the user owns keys
                            $inc: {
                                'userData.$.points': weeklyUserData.points
                            }
                        }
                    }
                });
            } else {
                updateOperations.push({
                    updateOne: {
                        filter: { _id: mainLeaderboard._id },
                        update: {
                            $push: {
                                // TO DO: increment the points with a multiplier if the user owns keys
                                userData: {
                                    userId: weeklyUserData.userId,
                                    points: weeklyUserData.points
                                }
                            }
                        }
                    }
                });
            }

            return updateOperations;
        }).flat();

        // execute the bulk write operations
        await LeaderboardModel.bulkWrite(bulkWriteOperations);

        console.log(`(addWeeklyToMainLeaderboard) Added weekly leaderboard data to the main leaderboard.`);
    } catch (err: any) {
        console.error(`(addWeeklyToMainLeaderboard) ${err.message}`);
    }
}

/**
 * Gets a leaderboard's rankings for users.
 * 
 * Sorts the user data by points in descending order.
 */
export const getLeaderboardRanking = async (type: LeaderboardType): Promise<ReturnValue> => {
    try {
        const leaderboard = await LeaderboardModel.findOne({ type }).lean();

        if (!leaderboard) {
            return {
                status: Status.ERROR,
                message: `(getLeaderboardRanking) Leaderboard not found.`
            };
        }

        // Sort the user data by points in descending order
        const descendingPoints = leaderboard.userData.sort((a, b) => b.points - a.points);

        // Extract user IDs from sorted data
        const userIds = descendingPoints.map(userData => userData.userId);

        // Retrieve all user data in a single query
        const users = await UserModel.find({_id: { $in: userIds }}).lean();

        // Create a map for quick user ID to Twitter ID lookup
        const userIdToTwitterIdMap = users.reduce((acc, user) => {
            acc[user._id.toString()] = user.twitterId;
            return acc;
        }, {});

        // Add a rank to each user data
        const rankedUserData = descendingPoints.map((userData, index) => ({
            rank: index + 1,
            userId: userIdToTwitterIdMap[userData.userId] || 'N/A',
            points: userData.points
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
    type: LeaderboardType
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getOwnLeaderboardRanking) User not found.`
            };
        }

        const leaderboard = await LeaderboardModel.findOne({ type }).lean();

        if (!leaderboard) {
            return {
                status: Status.ERROR,
                message: `(getOwnLeaderboardRanking) Leaderboard not found.`
            };
        }

        // Sort the leaderboard.userData by points in descending order to ensure ranking correctness
        const sortedUserData = leaderboard.userData.sort((a, b) => b.points - a.points);

        // Find the user's data and determine the rank simultaneously
        let userRank = -1; // Default value indicating not found
        const userData = sortedUserData.find((data, index) => {
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
                    userId: twitterId,
                    points: userData.points
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