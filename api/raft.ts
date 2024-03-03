import mongoose from 'mongoose'
import { RaftSchema } from '../schemas/Raft'
import { ReturnValue, Status } from '../utils/retVal';
import { generateObjectId } from '../utils/crypto';
import { UserSchema } from '../schemas/User';
import { BitSchema } from '../schemas/Bit';
import { RAFT_BIT_PLACEMENT_CAP } from '../utils/constants/raft';
import { Resource, ResourceType } from '../models/resource';
import { Bit } from '../models/bit';

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

/**
 * Claims the current amount of claimable seaweed from the user's raft and adds it to the user's inventory.
 * 
 * NOTE: Requires `twitterId` which is fetched via `req.user`, automatically giving us the user's Twitter ID. This will check if the user who calls this function owns the twitter ID that owns the island.
 */
export const claimSeaweed = async (twitterId: string): Promise<ReturnValue> => {
    const User = mongoose.model('Users', UserSchema, 'Users');
    const Raft = mongoose.model('Rafts', RaftSchema, 'Rafts');

    try {
        const user = await User.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimSeaweed) User not found.`
            }
        }

        // get the user's raft id
        const raftId: number = user.inventory?.raftId;

        // this shouldn't happen, but just in case
        if (!raftId) {
            return {
                status: Status.ERROR,
                message: `(claimSeaweed) User doesn't have a raft.`
            }
        }

        // query the raft
        const raft = await Raft.findOne({ raftId });

        if (!raft) {
            return {
                status: Status.ERROR,
                message: `(claimSeaweed) Raft not found.`
            }
        }

        // check if the user has any claimable seaweed via its `raftResourceStats`
        const claimableSeaweed = raft.raftResourceStats?.claimableSeaweed as number;

        if (claimableSeaweed === 0) {
            return {
                status: Status.ERROR,
                message: `(claimSeaweed) No claimable seaweed.`
            }
        }

        // do a few things:
        // 1. add the claimable seaweed to the user's inventory
        // 2. set the `claimableSeaweed` to 0
        // 3. set the `lastClaimed` to the current timestamp (unix)
        const seaweedIndex = (user.inventory?.resources as Resource[]).findIndex(resource => resource.type === ResourceType.SEAWEED);

        // if index doesn't exist, we add the seaweed to the user's inventory
        if (seaweedIndex === -1) {
            await User.updateOne({ twitterId }, {
                $push: {
                    'inventory.resources': {
                        type: ResourceType.SEAWEED,
                        amount: claimableSeaweed
                    }
                }
            })
        } else {
            await User.updateOne({ twitterId }, {
                $inc: {
                    [`inventory.resources.${seaweedIndex}.amount`]: claimableSeaweed
                }
            })
        }

        // update the raft
        await Raft.updateOne({ raftId }, {
            $set: { 
                'raftResourceStats.claimableSeaweed': 0, 
                'raftResourceStats.lastClaimed': Math.floor(Date.now() / 1000) 
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(claimSeaweed) Successfully claimed seaweed from user's raft.`,
            data: {
                claimableSeaweed
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimSeaweed) ${err.message}`
        }
    }
}

/**
 * (Called by scheduler, EVERY 10 MINUTES) Updates the amount of claimable seaweed of all users' rafts that are eligible to gather seaweed.
 */
export const updateClaimableSeaweed = async (): Promise<ReturnValue> => {
    const Raft = mongoose.model('Rafts', RaftSchema, 'Rafts');

    try {
        // get all rafts that have `gatheringStart` that is not equal to 0 and `placedBitIds` length > 0
        const rafts = await Raft.find({ 'raftResourceStats.gatheringStart': { $ne: 0 }, 'placedBitIds.0': { $exists: true } });

        for (const raft of rafts) {
            // calculate the amount of claimable seaweed within the last 10 minutes based on the gathering rate
            const gatheringRate = calcSeaweedGatheringRate(raft.placedBitIds as Bit[]);

            // divide the gathering rate by 6 to get the rate per 10 minutes
            const claimableSeaweed = gatheringRate / 6;

            // update the `claimableSeaweed` in the raft
            await Raft.updateOne({ raftId: raft.raftId }, { $inc: { 'raftResourceStats.claimableSeaweed': claimableSeaweed } });

            // log the update
            console.log(`(updateClaimableSeaweed) Updated claimable seaweed for user with raft ID ${raft.raftId}.`);
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(updateClaimableSeaweed) ${err.message}`
        }
    }
}

/**
 * Calculates the seaweed gathering rate of the user's raft per hour based on the bit's levels.
 */
export const calcSeaweedGatheringRate = (bits: Bit[]): number => {
    if (bits.length === 0) return 0;

    // at level 1, the gathering rate is 1 seaweed per hour. every level increase is 1.04x the rate of the previous level
    let gatheringRate = 0;

    for (const bit of bits) {
        gatheringRate += 1 * (1.04 ** (bit.currentFarmingLevel - 1));
    }

    return gatheringRate;
}