import mongoose from 'mongoose'
import { RaftSchema } from '../schemas/Raft'
import { ReturnValue, Status } from '../utils/retVal';
import { generateObjectId } from '../utils/crypto';

/**
 * Creates a new Raft for new users.
 * 
 * NOTE: No checks to see if the user already has a raft because it's done in the parent function, i.e. `handleTwitterLogin`.
 */
export const createRaft = async (userId: string): Promise<ReturnValue> => {
    const Raft = mongoose.model('Rafts', RaftSchema, 'Rafts');

    try {
        const { status, message: raftMessage, data } = await getLatestRaftId();
        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(createRaft) Error from getLatestRaftId: ${raftMessage}`
            }
        }

        const newRaft = new Raft({
            _id: generateObjectId(),
            raftId: data.latestRaftId + 1,
            owner: userId,
            placedBitIds: [],
            raftResourceStats: {
                seaweedGathered: [],
                claimableSeaweed: [],
                // gathering start will essentially start when the first bit is added
                gatheringStart: 0,
                lastClaimed: 0,
                currentGatheringRate: 0,
                gatheringProgress: 0
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

// export const placeBit = async (twitterId: string, bitId: number): Promise<ReturnValue> => {

// }

/**
 * Returns the latest (i.e. max) Raft ID that exists in the database.
 */
export const getLatestRaftId = async (): Promise<ReturnValue> => {
    const Raft = mongoose.model('Rafts', RaftSchema, 'Rafts');

    try {
        // get the latest Raft ID by counting the amount of rafts in the database
        const latestRaftId = await Raft.countDocuments();

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