import { ReturnValue, Status } from '../utils/retVal';
import { generateObjectId } from '../utils/crypto';
import { randomizeRaftCapacity, randomizeRaftSpeed } from '../utils/constants/raft';
import { BitModel, RaftModel, UserModel } from '../utils/constants/db';

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
            placedBitIds: [],
            stats: {
                speed: randomizeRaftSpeed(),
                capacity: randomizeRaftCapacity()
            },
            raftResourceStats: {
                seaweedGathered: 0,
                claimableSeaweed: 0,
                // gathering start will essentially start when the first bit is added
                gatheringStart: 0,
                lastClaimed: 0,
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
 * Places a Bit into a Raft.
 */
export const placeBit = async (twitterId: string, bitId: number): Promise<ReturnValue> => {
    try {
        const [user, bit] = await Promise.all([
            UserModel.findOne({ twitterId }).lean(),
            BitModel.findOne({ bitId }).lean()
        ]);

        const bitUpdateOperations = {
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
                message: `(placeBit) User not found.`
            }
        }

        // then, check if the user owns the bit to be placed
        if (!(user.inventory?.bitIds as number[]).includes(bitId)) {
            return {
                status: Status.ERROR,
                message: `(placeBit) User doesn't own the bit.`
            }
        }

        // get the raft id of the user
        const raftId: number = user.inventory?.raftId;

        // this shouldn't happen, but just in case
        if (!raftId) {
            return {
                status: Status.ERROR,
                message: `(placeBit) User doesn't have a raft.`
            }
        }

        // query the raft and the bit
        const raft = await RaftModel.findOne({ raftId }).lean();

        if (!raft) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Raft not found.`
            }
        }

        if (!bit) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Bit not found.`
            }
        }

        // check if the bit is already placed
        if (bit.placedIslandId !== 0 && bit.placedRaftId !== 0) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Bit already placed.`
            }
        }

        // check if the raft has reached its capacity
        if (raft.placedBitIds.length >= raft.stats.capacity) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Raft has reached its bit cap.`
            }
        }

        // update these things to the raft:
        // 1. if it's the first bit, update the `gatheringStart` to the current timestamp (unix)
        // 2. if it's the first bit, add `bitId` to `placedBitIds`. if not, just push `bitId` to `placedBitIds`
        if (raft.placedBitIds.length === 0) {
            raftUpdateOperations.$set['raftResourceStats.gatheringStart'] = Math.floor(Date.now() / 1000);
            raftUpdateOperations.$push['placedBitIds'] = bitId;
        } else {
            raftUpdateOperations.$push['placedBitIds'] = bitId;
        }

        // update the bit's placedRaftId
        bitUpdateOperations.$set['placedRaftId'] = raftId;

        // execute the update operations
        await Promise.all([
            RaftModel.updateOne({ raftId }, raftUpdateOperations),
            BitModel.updateOne({ bitId }, bitUpdateOperations)
        ]);

        return {
            status: Status.SUCCESS,
            message: `(placeBit) Bit placed in the raft.`,
            data: {
                bitId,
                raftId
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(placeBit) ${err.message}`
        }
    }
}

/**
 * Returns the latest (i.e. max) Raft ID that exists in the database.
 */
export const getLatestRaftId = async (): Promise<ReturnValue> => {
    try {
        // get the latest Raft ID by counting the amount of rafts in the database
        const latestRaftId = await RaftModel.countDocuments();

        return {
            status: Status.SUCCESS,
            message: `(getLatestRaftId) Successfully retrieved latest raft ID.`,
            data: { latestRaftId }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getLatestRaftId) ${err.message}`
        }
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