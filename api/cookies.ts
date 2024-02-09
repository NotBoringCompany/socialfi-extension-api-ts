import mongoose from 'mongoose';
import { UserSchema } from '../schemas/User';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Fetches the number of xCookies owned by the user.
 */
export const getOwnedXCookies = async (twitterId: string): Promise<ReturnValue> => {
    const User = mongoose.model('Users', UserSchema, 'Users');

    try {
        const user = await User.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getOwnedXCookies) User not found. Twitter ID: ${twitterId}`
            }
        }

        // return the number of xCookies owned by the user
        return {
            status: Status.SUCCESS,
            message: `(getOwnedXCookies) xCookies found.`,
            data: {
                xCookies: user.inventory.xCookies
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getOwnedXCookies) ${err.message}`
        }
    }
}