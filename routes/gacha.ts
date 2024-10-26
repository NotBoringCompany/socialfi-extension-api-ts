import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { authMiddleware } from '../middlewares/auth';
import { addWonderspin, fetchActiveWonderspins, fetchAllUserWonderspinData, rollWonderspin } from '../api/gacha';

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

router.get('/fetch_active_wonderspins', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'fetch_active_wonderspins');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            });
        }

        const { status, message, data } = await fetchActiveWonderspins();

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

router.get('/fetch_all_user_wonderspin_data', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'fetch_all_user_wonderspin_data');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            });
        }

        const { status, message, data } = await fetchAllUserWonderspinData(validateData?.twitterId);

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