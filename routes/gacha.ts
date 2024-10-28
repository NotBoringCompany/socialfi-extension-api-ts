import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { authMiddleware } from '../middlewares/auth';
import { addWonderspin, fetchActiveWonderspins, fetchCurrentActiveWonderspinData, fetchUserWonderspinData, rollWonderspin } from '../api/gacha';

const router = express.Router();

router.post('/add_wonderspin', authMiddleware(3), async (req, res) => {
    const { name, ticketType, active, fortuneCrestThreshold, fortuneSurgeThreshold, fortuneBlessingThreshold, fortunePeakThreshold, assetData } = req.body;
    try {
        const { status, message, data } = await addWonderspin(name, ticketType, active, fortuneCrestThreshold, fortuneSurgeThreshold, fortuneBlessingThreshold, fortunePeakThreshold, assetData);

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
});

router.get('/fetch_current_active_wonderspin_data', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'fetch_current_active_wonderspin_data');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            });
        }

        const { status, message, data } = await fetchCurrentActiveWonderspinData(validateData?.twitterId);

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        });
    }
});

router.post('/roll_wonderspin', async (req, res) => {
    const { ticket, wonderspin, amount } = req.body;
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'roll_wonderspin');
        
        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            });
        }
        
        const { status, message, data } = await rollWonderspin(validateData?.twitterId, ticket, wonderspin, amount);

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        });
    }
})

export default router;