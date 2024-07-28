import { NextFunction, Request, Response } from 'express';
import { SettingModel } from '../utils/constants/db';

/**
 * Checks if the backend is undergoing maintenance and prevents access to the API if it is.
 */
export const checkMaintenance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const settings = await SettingModel.findOne({ name: 'Maintenance' });

        if (!settings) {
            return next();
        }

        console.log('settings value: ', settings.value);
        console.log('type of settings value: ', typeof settings.value);

        if (settings.value === true) {
            return res.status(503).json({
                status: 503,
                message: 'The server is currently undergoing maintenance. Please try again later.'
            });
        }
    } catch (err: any) {
        console.error(`(checkMaintenance) ${err.message}`);
        return res.status(500).json({
            status: 500,
            message: err.message
        });
    }
}