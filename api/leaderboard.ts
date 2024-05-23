import { LeaderboardModel, UserModel } from '../utils/constants/db';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Adds a new leaderboard to the database. Only callable by admin.
 */
export const addLeaderboard = async (
    leaderboardName: string,
    startTimestamp: number | null,
    adminKey: string,
): Promise<ReturnValue> => {
    if (adminKey !== process.env.ADMIN_KEY) {
        return {
            status: Status.UNAUTHORIZED,
            message: `(addLeaderboard) Admin key is incorrect.`
        }
    }
    try {
        // check if leaderboard with the same name (regardless of casing) already exists
        const leaderboardExists = await LeaderboardModel.exists({ name: { $regex: new RegExp(`^${leaderboardName}$`, 'i') }});

        if (leaderboardExists) {
            return {
                status: Status.ERROR,
                message: `(addLeaderboard) Leaderboard with the same name already exists.`
            }
        }

        const leaderboard = new LeaderboardModel({
            name: leaderboardName,
            startTimestamp: startTimestamp || Math.floor(Date.now() / 1000),
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
 * Gets a leaderboard's rankings for users.
 * 
 * Sorts the user data by points in descending order.
 */
export const getLeaderboardRanking = async (leaderboardName: string): Promise<ReturnValue> => {
    try {
        const leaderboard = await LeaderboardModel.findOne({ name: leaderboardName }).lean();

        if (!leaderboard) {
            return {
                status: Status.ERROR,
                message: `(getLeaderboardRanking) Leaderboard not found.`
            };
        }

        // Sort the user data by points in descending order
        // userData contains `pointsData` which is an array of points data for different sources
        // we loop through each `pointsData` and sum up the points to get the total points for each user
        const descendingPoints = leaderboard.userData.sort((a, b) => {
            const aTotalPoints = a.pointsData?.reduce((acc, data) => acc + data.points, 0) ?? 0;
            const bTotalPoints = b.pointsData?.reduce((acc, data) => acc + data.points, 0) ?? 0;
            return bTotalPoints - aTotalPoints;
        });

        // Add a rank to each user data
        const rankedUserData = descendingPoints.map((userData, index) => ({
            rank: index + 1,
            userId: userData.userId,
            username: userData.username,
            twitterProfilePicture: userData.twitterProfilePicture,
            points: userData.pointsData?.reduce((acc, data) => acc + data.points, 0) ?? 0,
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
    leaderboardName: string,
): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getOwnLeaderboardRanking) User not found.`
            };
        }

        const leaderboard = await LeaderboardModel.findOne({ name: leaderboardName }).lean();

        if (!leaderboard) {
            return {
                status: Status.ERROR,
                message: `(getOwnLeaderboardRanking) Leaderboard not found.`
            };
        }

        // Sort the user data by points in descending order
        // userData contains `pointsData` which is an array of points data for different sources
        // we loop through each `pointsData` and sum up the points to get the total points for each user
        const descendingPoints = leaderboard.userData.sort((a, b) => {
            const aTotalPoints = a.pointsData?.reduce((acc, data) => acc + data.points, 0) ?? 0;
            const bTotalPoints = b.pointsData?.reduce((acc, data) => acc + data.points, 0) ?? 0;
            return bTotalPoints - aTotalPoints;
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
                    points: userData.pointsData?.reduce((acc, data) => acc + data.points, 0) ?? 0,
                    pointsData: userData.pointsData
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