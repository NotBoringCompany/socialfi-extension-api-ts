import { Bit } from '../models/bit';
import { ObtainMethod } from '../models/obtainMethod';
import { RANDOMIZE_GENDER } from '../utils/constants/bit';
import { RANDOMIZE_RARITY_FROM_ORB } from '../utils/constants/bitOrb';
import { ReturnValue, Status } from '../utils/retVal';
import { addBitToDatabase, getLatestBitId, randomizeFarmingStats } from './bit';
import { UserModel } from '../utils/constants/db';

/**
 * (User) Consumes a Bit Orb to obtain a Bit.
 */
export const consumeBitOrb = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {}
        }

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(consumeBitOrb) User not found.`
            }
        }

        // check if the user has at least 1 Bit Orb to consume
        if (user.inventory?.totalBitOrbs < 1) {
            return {
                status: Status.ERROR,
                message: `(consumeBitOrb) Not enough Bit Orbs to consume.`
            }
        }

        // consume the Bit Orb
        userUpdateOperations.$inc['inventory.totalBitOrbs'] = -1;

        // call `summonBit` to summon a Bit
        const { status: summonBitStatus, message: summonBitMessage, data: summonBitData } = await summonBit(user._id);

        if (summonBitStatus !== Status.SUCCESS) {
            return {
                status: summonBitStatus,
                message: `(consumeBitOrb) Error from summonBit: ${summonBitMessage}`
            }
        }

        const bit = summonBitData?.bit as Bit;

        // save the Bit to the database
        const { status: addBitStatus, message: addBitMessage } = await addBitToDatabase(bit);

        if (addBitStatus !== Status.SUCCESS) {
            return {
                status: addBitStatus,
                message: `(consumeBitOrb) Error from addBitToDatabase: ${addBitMessage}`
            }
        }

        // add the bit ID to the user's inventory
        userUpdateOperations.$push['inventory.bits'] = bit.bitId;

        // execute the update operation
        await UserModel.updateOne({ twitterId }, userUpdateOperations);

        return {
            status: Status.SUCCESS,
            message: `(consumeBitOrb) Bit Orb consumed and Bit obtained.`,
            data: {
                bit
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(consumeBitOrb) Error: ${err.message}`
        }
    }
}

/**
 * Summons a Bit obtained from a Bit Orb.
 */
export const summonBit = async (
    owner: string,
): Promise<ReturnValue> => {
    try {
        // get the latest bit id from the database
        const { status, message, data } = await getLatestBitId();

        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(randomizeBit) Error from getLatestBitId: ${message}`
            }
        }
        const latestBitId = data?.latestBitId as number;

        // get the Bit's rarity based on the probability of obtaining it
        const rarity = RANDOMIZE_RARITY_FROM_ORB();

        // randomize the gender 
        const gender = RANDOMIZE_GENDER();

        // summon and return the Bit. DOESN'T SAVE TO DATABASE YET.
        const bit: Bit = {
            bitId: latestBitId + 1,
            rarity,
            gender,
            premium: true,
            owner,
            purchaseDate: Math.floor(Date.now() / 1000),
            obtainMethod: ObtainMethod.BIT_ORB,
            totalXCookiesSpent: 0,
            placedIslandId: 0,
            placedRaftId: 0,
            currentFarmingLevel: 1,
            farmingStats: randomizeFarmingStats(rarity),
            bitStatsModifiers: {
                gatheringRateModifiers: [],
                earningRateModifiers: [],
                energyRateModifiers: []
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(summonBit) Bit randomized and summoned.`,
            data: {
                bit
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(summonBit) Error: ${err.message}`
        }

    }
}