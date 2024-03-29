import { LeaderboardType } from '../models/leaderboard';
import { LeaderboardModel } from '../utils/constants/db';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Adds a new leaderboard to the database. Only callable by admin.
 */
export const addLeaderboard = async (
    name: string,
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
        // check if leaderboard with the same name (check in lower case) already exists
        const leaderboardExists = await LeaderboardModel.exists({ name: name.toLowerCase() });

        if (leaderboardExists) {
            return {
                status: Status.ERROR,
                message: `(addLeaderboard) Leaderboard with the same name already exists.`
            }
        }

        const leaderboard = new LeaderboardModel({
            name: name,
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