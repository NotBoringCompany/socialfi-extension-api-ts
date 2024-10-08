import { ReturnValue, Status } from '../utils/retVal';
import { generateObjectId } from '../utils/crypto';
import { ACTUAL_RAFT_SPEED, RAFT_BASE_SPEED, RAFT_EVOLUTION_COST } from '../utils/constants/raft';
import { BitModel, RaftModel, UserModel } from '../utils/constants/db';
import { redis } from '../utils/constants/redis';

/**
 * Creates a new Raft for new users.
 * 
 * NOTE: No checks to see if the user already has a raft because it's done in the parent function, i.e. `handleTwitterLogin`.
 */
export const createRaft = async (userId: string): Promise<ReturnValue> => {
    try {
        const { status, message: raftMessage, data } = await getLatestRaftId();
        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(createRaft) Error from getLatestRaftId: ${raftMessage}`
            }
        }

        const newRaft = new RaftModel({
            _id: generateObjectId(),
            raftId: data.latestRaftId + 1,
            owner: userId,
            currentLevel: 1,
            stats: {
                baseSpeed: RAFT_BASE_SPEED
            }
        });

        await newRaft.save();

        return {
            status: Status.SUCCESS,
            message: `(createRaft) Raft created.`,
            data: {
                raft: newRaft
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(createRaft) ${err.message}`
        }
    }
}

/**
 * Returns the latest (i.e. max) Raft ID that exists in the database.
 */
export const getLatestRaftId = async (): Promise<ReturnValue> => {
    try {
        const raftId = await redis.get('counter.raftId');

        // check if the raftId was already set in Redis
        if (!raftId) {
            // sort the raft ids in descending order and get the first one
            const latestRaft = await RaftModel.findOne().sort({ raftId: -1 }).lean();

            // set the counter to the latest raft
            await redis.set('counter.raftId', latestRaft?.raftId ?? 0);
        }

        // increment the raft id counter
        const nextRaftId = await redis.incr('counter.raftId');

        return {
            status: Status.SUCCESS,
            message: `(getLatestRaftId) Latest raft id fetched.`,
            data: {
                latestRaftId: nextRaftId ?? 0,
            },
        };
    } catch (err: any) {        
        return {
            status: Status.ERROR,
            message: `(getLatestRaftId) Error: ${err.message}`,
        };
    }
}

/**
 * Returns the Raft of the user.
 */
export const getRaft = async (twitterId: string): Promise<ReturnValue> => {
    try {
        // check if user exists
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getRaft) User not found.`
            }
        }

        // get the raft id of the user
        const raftId: number = user.inventory?.raftId;

        // this shouldn't happen, but just in case
        if (!raftId) {
            return {
                status: Status.ERROR,
                message: `(getRaft) User doesn't have a raft.`
            }
        }

        // query the raft
        const raft = await RaftModel.findOne({ raftId }).lean();

        if (!raft) {
            return {
                status: Status.ERROR,
                message: `(getRaft) Raft not found.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getRaft) Successfully retrieved the user's raft.`,
            data: {
                raft
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getRaft) ${err.message}`
        }
    }
}

/**
 * Gets the actual speed of the raft (base speed + level).
 */
export const getActualRaftSpeed = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getActualRaftSpeed) User not found.`
            }
        }

        const raftId = user.inventory?.raftId;

        if (!raftId) {
            return {
                status: Status.ERROR,
                message: `(getActualRaftSpeed) User doesn't have a raft.`
            }
        }

        const raft = await RaftModel.findOne({ raftId: raftId }).lean();

        if (!raft) {
            return {
                status: Status.ERROR,
                message: `(getActualRaftSpeed) Raft not found.`
            }
        }

        // get the base speed of the raft
        const baseSpeed = raft.stats.baseSpeed;

        // calculate the actual speed of the raft
        const actualSpeed = ACTUAL_RAFT_SPEED(baseSpeed, raft.currentLevel);

        return {
            status: Status.SUCCESS,
            message: `(getActualRaftSpeed) Successfully calculated the actual speed of the raft.`,
            data: {
                actualSpeed
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getActualRaftSpeed) ${err.message}`
        }
    }
}

/**
 * Evolves/upgrades a user's raft.
 */
export const evolveRaft = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        const raftUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(upgradeRaft) User not found.`
            }
        }

        const raftId = user.inventory?.raftId;

        if (!raftId) {
            return {
                status: Status.ERROR,
                message: `(upgradeRaft) User doesn't have a raft.`
            }
        }

        const raft = await RaftModel.findOne({ raftId: raftId });

        if (!raft) {
            return {
                status: Status.ERROR,
                message: `(upgradeRaft) Raft not found.`
            }
        }

        // get the raft's current level
        const raftLevel = raft.currentLevel;

        // get the cost to upgrade the raft
        const upgradeCost = RAFT_EVOLUTION_COST(raftLevel);

        // check if the user has enough xCookies to upgrade the raft
        if (user.inventory?.xCookieData.currentXCookies < upgradeCost) {
            return {
                status: Status.BAD_REQUEST,
                message: `(upgradeRaft) User doesn't have enough xCookies to upgrade the raft.`
            }
        }

        // deduct the xCookies from the user and increment `totalXCookiesSpent` and `weeklyXCookiesSpent`
        userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = -upgradeCost;
        userUpdateOperations.$inc['inventory.xCookieData.totalXCookiesSpent'] = upgradeCost;
        userUpdateOperations.$inc['inventory.xCookieData.weeklyXCookiesSpent'] = upgradeCost;

        // upgrade the raft
        raftUpdateOperations.$inc['currentLevel'] = 1;

        // execute the update operations
        await Promise.all([
            UserModel.updateOne({ twitterId }, userUpdateOperations),
            RaftModel.updateOne({ raftId }, raftUpdateOperations)
        ]);

        return {
            status: Status.SUCCESS,
            message: `(upgradeRaft) Successfully upgraded the user's raft.`,
            data: {
                raftId: raftId,
                currentLevel: raft.currentLevel,
                nextLevel: raft.currentLevel + 1,
                totalPaid: upgradeCost,
                paymentChoice: 'xCookies',
                userCurrency: {
                    currentValue: user.inventory.xCookieData.currentXCookies,
                    updatedValue: Math.max(user.inventory.xCookieData.currentXCookies - upgradeCost, 0),
                }
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(upgradeRaft) ${err.message}`
        }
    }
}

/**
 * Gets the actual stats of a raft (including current and evolution stats).
 */
export const getRaftActualStats = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getRaftActualStats) User not found.`
            }
        }

        const raftId = user.inventory?.raftId;

        if (!raftId) {
            return {
                status: Status.ERROR,
                message: `(getRaftActualStats) User doesn't have a raft.`
            }
        }

        const raft = await RaftModel.findOne({ raftId: raftId }).lean();

        if (!raft) {
            return {
                status: Status.ERROR,
                message: `(getRaftActualStats) Raft not found.`
            }
        }

        // current stats include only the speed of the raft
        // get the current speed at this level and the evolution speed if the raft is evolved to the next level
        const currentStats = {
            currentSpeed: ACTUAL_RAFT_SPEED(raft.stats.baseSpeed, raft.currentLevel),
            evolutionSpeed: ACTUAL_RAFT_SPEED(raft.stats.baseSpeed, raft.currentLevel + 1)
        }

        return {
            status: Status.SUCCESS,
            message: `(getRaftCurrentStats) Successfully retrieved the current stats of the user's raft.`,
            data: {
                currentStats
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getRaftCurrentStats) ${err.message}`
        }
    }
}