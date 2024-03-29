import { LeaderboardType } from '../models/leaderboard';
import { LeaderboardModel } from '../utils/constants/db';
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