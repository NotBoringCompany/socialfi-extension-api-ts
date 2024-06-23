import { axios } from '../configs/axios';
import { Creds } from '../models/auth';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * This function is used to verify a token from the Wonderverse backend.
 *
 * @param token Token obtained from the Wonderverse backend.
 * @returns Promise<ReturnValue> The result of the token verification.
 */
export const verifyToken = async (token: string): Promise<ReturnValue<Creds>> => {
    try {
        const res = await axios.get('/auth/me', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        return res.data;
    } catch (err) {
        return {
            status: err.response?.data?.status ?? Status.ERROR,
            message: `(verifyToken) ${err.response?.data?.message ?? 'Authorization failed'}`,
            data: undefined,
        };
    }
};
