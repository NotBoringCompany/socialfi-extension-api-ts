import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { IslandSchema } from '../schemas/Island';
import { Island, IslandType } from '../models/island';
import { DEFAULT_RESOURCE_CAP } from '../utils/constants/island';

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