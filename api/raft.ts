import mongoose from 'mongoose'
import { RaftSchema } from '../schemas/Raft'
import { ReturnValue, Status } from '../utils/retVal';
import { generateObjectId } from '../utils/crypto';
import { UserSchema } from '../schemas/User';
import { BitSchema } from '../schemas/Bit';
import { RAFT_BIT_PLACEMENT_CAP, MAX_RAFT_LEVEL, RAFT_EVOLUTION_COST } from '../utils/constants/raft';
import { Resource, ResourceType } from '../models/resource';

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
            currentLevel: 1,
            placedBitIds: [],
            raftResourceStats: {
                seaweedGathered: [],
                claimableSeaweed: [],
                // gathering start will essentially start when the first bit is added
                gatheringStart: 0,
                lastClaimed: 0,
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

/**
 * (User) Evolves the user's raft (levelling it up).
 * 
 * NOTE: Requires `twitterId` which is fetched via `req.user`, automatically giving us the user's Twitter ID. This will check if the user who calls this function owns the twitter ID that owns the island.
 */
export const evolveRaft = async (twitterId: string): Promise<ReturnValue> => {
    const User = mongoose.model('Users', UserSchema, 'Users');
    const Raft = mongoose.model('Rafts', RaftSchema, 'Rafts');

    try {
        const user = await User.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(evolveRaft) User not found.`
            }
        }

        // this shouldn't happen, but if the user's raftId is 0, then throw an error
        if (user.inventory?.raftId === 0) {
            return {
                status: Status.ERROR,
                message: `(evolveRaft) User doesn't have a raft.`
            }
        }

        // get the user's raft id
        const raftId: number = user.inventory?.raftId;

        // query the raft
        const raft = await Raft.findOne({ raftId });

        if (!raft) {
            return {
                status: Status.ERROR,
                message: `(evolveRaft) Raft not found.`
            }
        }

        // check if the raft is already at max level, if it is, throw an error
        if (raft.currentLevel >= MAX_RAFT_LEVEL) {
            return {
                status: Status.ERROR,
                message: `(evolveRaft) Raft is already at max level.`
            }
        }

        // check if the user has enough seaweed to evolve the raft
        const userSeaweed = (user.inventory?.resources as Resource[]).find(resource => resource.type === ResourceType.SEAWEED)?.amount ?? 0;

        // calculate the cost to evolve the raft
        const requiredSeaweed = RAFT_EVOLUTION_COST(raft.currentLevel);

        // if the user doesn't have enough seaweed, throw an error
        if (userSeaweed < requiredSeaweed) {
            return {
                status: Status.ERROR,
                message: `(evolveRaft) User doesn't have enough seaweed to evolve the raft.`
            }
        }

        const seaweedIndex = (user.inventory?.resources as Resource[]).findIndex(resource => resource.type === ResourceType.SEAWEED);

        // this shouldn't happen, but just in case
        if (seaweedIndex === -1) {
            return {
                status: Status.ERROR,
                message: `(evolveRaft) Seaweed not found in user's inventory.`
            }
        }

        // deduct the seaweed from the user's inventory
        await User.updateOne({ twitterId }, {
            $inc: {
                [`inventory.resources.${seaweedIndex}.amount`]: -requiredSeaweed
            }
        });

        // evolve the raft
        await Raft.updateOne({ raftId }, {
            $inc: { currentLevel: 1 }
        });

        return {
            status: Status.SUCCESS,
            message: `(evolveRaft) Raft evolved.`,
            data: {
                raftId: raftId,
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(evolveRaft) ${err.message}`
        }
    }
}

/**
 * Places a Bit into a Raft.
 */
export const placeBit = async (twitterId: string, bitId: number): Promise<ReturnValue> => {
    const Raft = mongoose.model('Rafts', RaftSchema, 'Rafts');
    const User = mongoose.model('Users', UserSchema, 'Users');
    const Bit = mongoose.model('Bits', BitSchema, 'Bits');

    try {
        // check if user exists
        const user = await User.findOne({ twitterId });

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
        const raft = await Raft.findOne({ raftId });
        const bit = await Bit.findOne({ bitId });

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

        // check if the raft has reached its bit cap
        if (raft.placedBitIds.length >= RAFT_BIT_PLACEMENT_CAP) {
            return {
                status: Status.ERROR,
                message: `(placeBit) Raft has reached its bit cap.`
            }
        }

        // update these things to the raft:
        // 1. if it's the first bit, update the `gatheringStart` to the current timestamp (unix)
        // 2. if it's the first bit, add `bitId` to `placedBitIds`. if not, just push `bitId` to `placedBitIds`
        if (raft.placedBitIds.length === 0) {
            await Raft.updateOne({ raftId }, {
                $set: { 'raftResourceStats.gatheringStart': Math.floor(Date.now() / 1000) },
                $push: { placedBitIds: bitId }
            });
        } else {
            await Raft.updateOne({ raftId }, { $push: { placedBitIds: bitId } });
        }

        // update the bit's placedRaftId
        await Bit.updateOne({ bitId }, { $set: { placedRaftId: raftId } });

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

/**
 * Returns the Raft of the user.
 */
export const getRaft = async (twitterId: string): Promise<ReturnValue> => {
    const Raft = mongoose.model('Rafts', RaftSchema, 'Rafts');
    const User = mongoose.model('Users', UserSchema, 'Users');

    try {
        // check if user exists
        const user = await User.findOne({ twitterId });

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
        const raft = await Raft.findOne({ raftId });

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