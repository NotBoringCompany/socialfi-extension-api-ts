import { POAPModel, UserModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Adds a POAP to the database.
 */
export const addPOAP = async (data: POAP): Promise<ReturnValue> => {
    try {
        // create a new poap instance
        const poap = new POAPModel({
            _id: generateObjectId(),
            ...data,
            createTimestamp: Math.floor(Date.now() / 1000),
        });

        // save the poap
        await poap.save();

        console.log('(addPOAP) Successfully added POAP with name:', data.name);

        return {
            status: Status.SUCCESS,
            message: `(addPOAP) Successfully added POAP with name: ${data.name}`,
        };
    } catch (err: any) {
        console.log('(addPOAP) Error:', err.message);
        return {
            status: Status.ERROR,
            message: `(addPOAP) Error: ${err.message}`,
        };
    }
};

/**
 * Gets all POAP from the database.
 */
export const getAllPOAP = async (): Promise<ReturnValue> => {
    try {
        const poap = await POAPModel.find({}, { codes: 0, attendances: 0 });

        return {
            status: Status.SUCCESS,
            message: '(getPOAP) Successfully retrieved POAP.',
            data: {
                poap: poap,
            },
        };
    } catch (err: any) {
        console.log('(getPOAP) Error:', err.message);
        return {
            status: Status.ERROR,
            message: `(getPOAP) Error: ${err.message}`,
        };
    }
};

/**
 * Gets user redeemed POAP from the database.
 */
export const getUserPOAP = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const poap = await POAPModel.find({ attendances: { twitterId } }, { codes: 0, attendances: 0 });

        return {
            status: Status.SUCCESS,
            message: '(getUserPOAP) Successfully retrieved user POAP.',
            data: {
                poap: poap,
            },
        };
    } catch (err: any) {
        console.log('(getUserPOAP) Error:', err.message);
        return {
            status: Status.ERROR,
            message: `(getUserPOAP) Error: ${err.message}`,
        };
    }
};

/**
 * Redeem a POAP code for a user.
 */
export const redeemCode = async (id: string, twitterId: string, code: string): Promise<ReturnValue> => {
    try {
        // find the POAP event
        const poap = await POAPModel.findById(id);
        if (!poap) {
            return {
                status: Status.ERROR,
                message: `(redeemCode) POAP not found.`,
            };
        }

        const user = await UserModel.findOne({ twitterId });
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(redeemCode) User not found. Twitter ID: ${twitterId}`,
            };
        }

        // current timestamp
        const currentTimestamp = Math.floor(Date.now() / 1000);

        // find the POAP code
        const poapCode = poap.codes.find((c) => c.keyword === code);

        // check if the code exists
        if (!poapCode) {
            return {
                status: Status.ERROR,
                message: `(redeemCode) Code don't exist.`,
            };
        }

        // check if the code is not expired
        if (poapCode.expirationTimestamp < currentTimestamp) {
            return {
                status: Status.ERROR,
                message: `(redeemCode) Code expired.`,
            };
        }

        // check if the code still avaliable
        if (poapCode.limit != -1 && poap.attendances.length >= poapCode.limit) {
            return {
                status: Status.ERROR,
                message: `(redeemCode) Code limit reached.`,
            };
        }

        // Check if the user has already redeemed this code
        const hasRedeemed = poap.attendances.some((attendance) => attendance.twitterId === twitterId);
        if (hasRedeemed) {
            return {
                status: Status.ERROR,
                message: `(redeemCode) Code has already been redeemed.`,
            };
        }

        await poap.updateOne({
            $push: {
                attendances: {
                    twitterId: user.twitterId,
                    keyword: code,
                    attendanceTimestamp: currentTimestamp,
                },
            },
        });

        return {
            status: Status.SUCCESS,
            message: `(redeemCode) Code accepted.`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(redeemCode) Error: ${err.message}`,
        };
    }
};
