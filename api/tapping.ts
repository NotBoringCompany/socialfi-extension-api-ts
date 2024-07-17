import { Tapping, TappingType } from "../models/tapping";
import { UserModel } from "../utils/constants/db";
import { ReturnValue, Status } from "../utils/retVal";

export const getUserTapping = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getUserTapping) User not found.`,
            };
        }

        const tappingData: Tapping = {
            amount: 25,
            type: TappingType.ISLAND,
        };

        return {
            status: Status.SUCCESS,
            message: `(getUserTapping), fetch User Tapping`,
            data: {
                tappingData
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getUserTapping) Error: ${err.message}`
        }
    }  
};

export const applyTapping = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getUserTapping) User not found.`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(applyTapping), Apply tapping success`,
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(applyTapping) Error: ${err.message}`
        }
    }
}