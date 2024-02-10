import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { BitSchema } from '../schemas/Bit';
import { Bit, BitFarmingStats, BitRarity } from '../models/bit';
import { BASE_ENERGY_DEPLETION_RATE, DEFAULT_EARNING_RATE, DEFAULT_EARNING_RATE_GROWTH, DEFAULT_GATHERING_RATE, DEFAULT_GATHERING_RATE_GROWTH } from '../utils/constants/bit';
import { GATHERING_RATE_EXPONENTIAL_DECAY } from '../utils/constants/game';

/**
 * Adds a bit (e.g. when summoned via Bit Orb) to the database.
 */
export const addBitToDatabase = async (bit: Bit): Promise<ReturnValue> => {
    const Bit = mongoose.model('Bits', BitSchema, 'Bits');

    try {
        const newBit = new Bit(bit);

        await newBit.save();

        return {
            status: Status.SUCCESS,
            message: `(addBitToDatabase) Bit added to database.`,
            data: {
                bit: newBit
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addBitToDatabase) Error: ${err.message}`
        }
    }
}

/**
 * Fetches the latest bit id from the database.
 */
export const getLatestBitId = async (): Promise<ReturnValue> => {
    const Bit = mongoose.model('Bits', BitSchema, 'Bits');

    try {
        const latestBitId = await Bit.countDocuments();

        return {
            status: Status.SUCCESS,
            message: `(getLatestBitId) Latest bit id fetched.`,
            data: {
                latestBitId
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getLatestBitId) Error: ${err.message}`
        }
    }
}

/**
 * Randomizes the farming stats of a Bit.
 */
export const randomizeFarmingStats = (rarity: BitRarity): BitFarmingStats => {
    // get the default gathering rate
    const defaultGatheringRate = DEFAULT_GATHERING_RATE(rarity);
    // get the default gathering rate growth
    const defaultGatheringRateGrowth = DEFAULT_GATHERING_RATE_GROWTH(rarity);
    // get the default earning rate
    const defaultEarningRate = DEFAULT_EARNING_RATE(rarity);
    // get the default earning rate growth
    const defaultEarningRateGrowth = DEFAULT_EARNING_RATE_GROWTH(rarity);
    // get the base energy depletion rate
    const baseEnergyDepletionRate = BASE_ENERGY_DEPLETION_RATE;

    // rand from 0.9 to 1.1 to determine base gathering rate (and also current gathering rate since it's at level 1)
    const randGatheringRate = Math.random() * 0.2 + 0.9;
    const baseGatheringRate = defaultGatheringRate * randGatheringRate;

    // rand from 0.9 to 1.1 to determine gathering rate growth
    const randGatheringRateGrowth = Math.random() * 0.2 + 0.9;
    const gatheringRateGrowth = defaultGatheringRateGrowth * randGatheringRateGrowth;

    // rand from 0.9 to 1.1 to determine base earning rate (and also current earning rate since it's at level 1)
    const randEarningRate = Math.random() * 0.2 + 0.9;
    const baseEarningRate = defaultEarningRate * randEarningRate;

    // rand from 0.9 to 1.1 to determine earning rate growth
    const randEarningRateGrowth = Math.random() * 0.2 + 0.9;
    const earningRateGrowth = defaultEarningRateGrowth * randEarningRateGrowth;

    // rand from 0.75 to 1.25 to determine current energy depletion rate
    const randEnergyDepletionRate = Math.random() * 0.5 + 0.75;
    const currentEnergyDepletionRate = baseEnergyDepletionRate * randEnergyDepletionRate;


    return {
        baseGatheringRate,
        gatheringRateGrowth,
        currentGatheringRate: baseGatheringRate,
        baseEarningRate,
        earningRateGrowth,
        currentEarningRate: baseEarningRate,
        currentEnergyDepletionRate,
        currentEnergy: 100
    }
}

/**
 * Calculates the current gathering OR earning rate of the bit (at level `bitLevel`).
 * 
 * Since both rates use the same formula, only the parameters need to be adjusted according to which rate wants to be calculated.
 */
export const calcCurrentRate = (
    // base gathering/earning rate
    baseRate: number,
    bitLevel: number,
    // initial gathering/earning growth rate
    initialGrowthRate: number
): number => {
    return baseRate + ((bitLevel - 1) * initialGrowthRate) * Math.exp(-GATHERING_RATE_EXPONENTIAL_DECAY * (bitLevel - 1));
}