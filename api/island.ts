import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { IslandSchema } from '../schemas/Island';
import { Island, IslandType, RateType } from '../models/island';
import { DEFAULT_RESOURCE_CAP, EARNING_RATE_REDUCTION_MODIFIER, GATHERING_RATE_REDUCTION_MODIFIER } from '../utils/constants/island';
import { Bit } from '../models/bit';
import { calcCurrentRate } from './bit';

/**
 * Adds an island (e.g. when obtained via Terra Capsulator) to the database.
 */
export const addIslandToDatabase = async (island: Island): Promise<ReturnValue> => {
    const Island = mongoose.model('Islands', IslandSchema, 'Islands');

    try {
        const newIsland = new Island(island);

        await newIsland.save();

        return {
            status: Status.SUCCESS,
            message: `(addIslandToDatabase) Island added to database.`,
            data: {
                island: newIsland
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addIslandToDatabase) Error: ${err.message}`
        }
    }

}

/**
 * Fetches the latest island id from the database.
 */
export const getLatestIslandId = async (): Promise<ReturnValue> => {
    const Island = mongoose.model('Islands', IslandSchema, 'Islands');

    try {
        const latestIslandId = await Island.countDocuments();

        return {
            status: Status.SUCCESS,
            message: `(getLatestIslandId) Latest island id fetched.`,
            data: {
                latestIslandId
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getLatestIslandId) Error: ${err.message}`
        }
    }
}

/**
 * Randomizes the base resource cap of an Island.
 */
export const randomizeBaseResourceCap = (type: IslandType): number => {
    // get the default resource cap based on the island type
    const defaultResourceCap = DEFAULT_RESOURCE_CAP(type);

    // rand between 0.8 and 1.2 to multiply the default resource cap by
    const resCapRand = Math.random() * 0.4 + 0.8;

    return defaultResourceCap * resCapRand;
}

/**
 * Calculates the effective gathering/earning rate of the island, based on the amount of bits placed on the island.
 * 
 * NOTE: to prevent miscalculations, ensure that:
 * 
 * 1. `baseRates`, `bitLevels`, and `initialGrowthRates` are all of the same length.
 * 
 * 2. the indexes of each array correspond to the same bit; for example, if `baseRates[0]` = 0.025, `bitLevels[0]` = 3 and `initialGrowthRates[0]` = 0.0002,
 * this should mean that Bit #1 has a base gathering/earning rate of 0.025, is at level 3, and has an initial growth rate of 0.0002.
 */
export const calcEffectiveRate = (
    type: RateType,
    baseRates: number[],
    bitLevels: number[],
    initialGrowthRates: number[]
): number => {
    // check if all arrays have the same length, else throw an error.
    if (baseRates.length === bitLevels.length && bitLevels.length === initialGrowthRates.length) {
        let sum = 0;
        // `n` refers to the total number of bits; since all arrays at this point are assumed the same length, we can just pick any of the lengths.
        let n = baseRates.length;

        for (let i = 0; i < n; i++) {
            // get the current rate for each bit
            const currentRate = calcCurrentRate(type, baseRates[i], bitLevels[i], initialGrowthRates[i]);

            // add the current rate to the sum
            sum += currentRate;
        }

        // multiply the sum with the reduction modifier part of the formula
        const reductionModifier = type === RateType.GATHERING ? GATHERING_RATE_REDUCTION_MODIFIER : EARNING_RATE_REDUCTION_MODIFIER;

        return sum * (1 - (reductionModifier * (n - 1)));
    } else {
        throw new Error(`(calcEffectiveRate) Arrays are not of the same length.`);
    }
}