import axios from 'axios';
import { ReturnValue, Status } from '../utils/retVal';
import { LineErrorResponse, LineProfile, VerifiedTokenResponse } from '../models/line';

/**
 * Used to verify OAuth token provided by LIFF platform
 */
export const verifyLineToken = async (accessToken: string): Promise<ReturnValue<VerifiedTokenResponse>> => {
    try {
        const result = await axios.get<VerifiedTokenResponse>('https://api.line.me/oauth2/v2.1/verify', {
            params: {
                access_token: accessToken,
            },
        });

        return {
            status: Status.SUCCESS,
            message: `(verifyLineToken) Token verified successfully`,
            data: {
                ...result.data,
            },
        };
    } catch (err: any) {
        if (err.response) {
            const { error, error_description } = err.response as LineErrorResponse;

            return {
                status: Status.ERROR,
                message: `(verifyLineToken) ${error}, ${error_description}`,
            };
        }

        return {
            status: Status.ERROR,
            message: `(verifyLineToken) ${err.message}`,
        };
    }
};

/**
 * Get LINE user's profile using access token.
 */
export const getLineProfile = async (accessToken: string): Promise<ReturnValue<LineProfile>> => {
    try {
        const result = await axios.get<LineProfile>('https://api.line.me/v2/profile', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(getLineProfile) Profile fetched successfully`,
            data: {
                ...result.data,
            },
        };
    } catch (err: any) {
        if (err.response) {
            const { error, error_description } = err.response as LineErrorResponse;

            return {
                status: Status.ERROR,
                message: `(getLineProfile) ${error}, ${error_description}`,
            };
        }

        return {
            status: Status.ERROR,
            message: `(getLineProfile) ${err.message}`,
        };
    }
};
