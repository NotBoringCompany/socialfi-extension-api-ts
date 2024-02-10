import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { BitSchema } from '../schemas/Bit';

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