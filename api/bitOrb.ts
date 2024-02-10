import mongoose from 'mongoose';
import { Bit } from '../models/bit';
import { ObtainMethod } from '../models/obtainMethod';
import { RANDOMIZE_GENDER } from '../utils/constants/bit';
import { RANDOMIZE_RARITY_FROM_ORB } from '../utils/constants/bitOrb';
import { ReturnValue, Status } from '../utils/retVal';
import { addBitToDatabase, getLatestBitId, randomizeFarmingStats } from './bit';
import { UserSchema } from '../schemas/User';

/**
 * (User) Consumes a Bit Orb to obtain a Bit.
 */
export const consumeBitOrb = async (twitterId: string): Promise<ReturnValue> => {
    const User = mongoose.model('Users', UserSchema, 'Users');

    try {
        const user = await User.findOne({ twitterId });

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
        await User.updateOne({ twitterId }, { $inc: { 'inventory.totalBitOrbs': -1 } });

        // call `summonBit` to summon a Bit
        const { status: summonBitStatus, message: summonBitMessage, data: summonBitData } = await summonBit(user._id, ObtainMethod.BIT_ORB, 0);

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
        await User.updateOne({ twitterId }, { $push: { 'inventory.bitIds': bit.bitId } });  

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
    obtainMethod: ObtainMethod,
    totalCookiesSpent: number
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
        const latestBitId = data?.latestBitId;

        // get the Bit's rarity based on the probability of obtaining it
        const rarity = RANDOMIZE_RARITY_FROM_ORB();

        // randomize the gender 
        const gender = RANDOMIZE_GENDER();


        // summon and return the Bit. DOESN'T SAVE TO DATABASE YET.
        const bit: Bit = {
            bitId: latestBitId + 1,
            rarity,
            gender,
            owner,
            purchaseDate: Math.floor(Date.now() / 1000),
            obtainMethod,
            totalCookiesSpent,
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