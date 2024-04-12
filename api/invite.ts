import mongoose from 'mongoose';
import { StarterCodeData } from '../models/invite';
import { StarterCodeModel } from '../utils/constants/db';
import { generateObjectId, generateStarterCode } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Generates starter codes and stores them in the database.
 * 
 * `amount` is the amount of starter codes to generate.
 * 
 * `maxUses`'s length should be equal to `amount`, and each element represents the maximum uses for each starter code.
 */
export const generateStarterCodes = async (
    amount: number,
    maxUses: number[],
    adminKey: string,
): Promise<ReturnValue> => {
    if (adminKey !== process.env.ADMIN_KEY) {
        return {
            status: Status.UNAUTHORIZED,
            message: `(generateStarterCodes) Invalid admin key.`
        }
    }

    try {
        if (amount !== maxUses.length) {
            return {
                status: Status.ERROR,
                message: `(generateStarterCodes) Amount of starter codes does not match amount of max uses.`
            }
        }

        const starterCodes: Array<any> = [];

        for (let i = 0; i < amount; i++) {
            const code = generateStarterCode();

            starterCodes.push({
                _id: generateObjectId(),
                code,
                maxUses: maxUses[i],
                usedBy: []
            });
        }

        await StarterCodeModel.insertMany(starterCodes);

        return {
            status: Status.SUCCESS,
            message: `(generateStarterCodes) Starter codes generated.`,
            data: {
                starterCodes
            }
        }
    } catch (err: any) {
        console.log('(generateStarterCodes)', err.message);
        return {
            status: Status.ERROR,
            message: `(generateStarterCodes) ${err.message}`
        }
    }
}