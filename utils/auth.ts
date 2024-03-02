import {Request, Response} from 'express';
import { ReturnValue, Status } from './retVal';
import { validateJWT } from './jwt';

/**
 * Checks JWT token validity obtained from request headers in required REST API routes.
 */
export const validateRequestAuth = async (
    req: Request, 
    res: Response,
    // used for error message logging
    routeName: string
): Promise<ReturnValue> => {
    // allow from twitter.com
    res.header('Access-Control-Allow-Origin', 'https://twitter.com');
    res.header('Access-Control-Allow-Methods', 'POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // bearer JWT token

        if (!token) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(${routeName ?? 'validateRequestAuth'}) No token provided.`
            }
        }

        const { status, message, data } = validateJWT(token);
        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(${routeName ?? 'validateRequestAuth'}) ${message}`
            }
        }

        const { twitterId } = data;

        if (!twitterId) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(${routeName ?? 'validateRequestAuth'}) You denied the app or the token is invalid/expired.`
            }
        }

        // at this point, the token is deemed valid and we return the twitter id.
        return {
            status: Status.SUCCESS,
            message: `(${routeName ?? 'validateRequestAuth'}) Token is valid.`,
            data: {
                twitterId
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(${routeName ?? 'validateRequestAuth'}) ${err.message}`
        }
    }
}