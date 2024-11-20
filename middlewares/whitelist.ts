import { NextFunction, Request, Response } from 'express';
import { Status } from '../utils/retVal';
import { validateJWT } from '../utils/jwt';
import { SettingModel } from '../utils/constants/db';

/**
 * Check if the user got whitelisted.
 */
export const whitelistMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Methods', 'POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
        const keySetting = await SettingModel.findOne({ key: 'whitelist-status' });

        if (!keySetting.value) return next();

        const userSetting = await SettingModel.findOne({ key: 'whitelist-user' });

        const twitterIds = (userSetting.value as string).split(',');

        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // bearer JWT token

        if (!token) {
            return next();
        }

        const { status, message, data } = validateJWT(token);
        if (status !== Status.SUCCESS) {
            return res.status(503).json({
                status: 503,
                message: 'The server is currently undergoing maintenance. Please try again later.'
            });
        }

        const { twitterId } = data;

        if (!twitterId || !twitterIds.includes(twitterId)) {
            return res.status(503).json({
                status: 503,
                message: 'The server is currently undergoing maintenance. Please try again later.'
            });
        }

        next();
    } catch (err: any) {
        console.error(`(whitelistMiddleware) ${err.message}`);
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
};
