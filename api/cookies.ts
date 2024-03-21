import { ReturnValue, Status } from '../utils/retVal';
import { UserModel } from '../utils/constants/db';

/**
 * Fetches the number of xCookies owned by the user.
 */
export const getOwnedXCookies = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

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