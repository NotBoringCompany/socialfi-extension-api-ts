import { WonderpassLevelData } from '../models/wonderpass';
import { WonderpassModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Adds a Wonderpass to the database.
 */
export const addWonderpass = async (
    name: string,
    startTimestamp: number,
    endTimestamp: number,
    levelData: WonderpassLevelData[]
): Promise<void> => {
    try {
        // NOTE: Only 1 active Wonderpass can exist (either fully or partially) between `start` and `end`.
        // if the times overlap with an existing wonderpass, return an error
        const existingWonderpass = await WonderpassModel.findOne({
            // find a wonderpass where:
            // 1. the start time is before or equal to the new wonderpass's end time
            // 2. the end time is after or equal to the new wonderpass's start time
            start: { $lte: endTimestamp },
            end: { $gte: startTimestamp }
        });

        if (existingWonderpass) {
            throw new Error(`(addWonderpass) A Wonderpass already exists between ${startTimestamp} and ${endTimestamp}`);
        }

        // add the new wonderpass
        await WonderpassModel.create({
            _id: generateObjectId(),
            name,
            start: startTimestamp,
            end: endTimestamp,
            levelData
        });

        console.log(`(addWonderpass) Added Wonderpass: ${name}`);
    } catch (err: any) {
        throw new Error(`(addWonderpass) ${err.message}`);
    }
}