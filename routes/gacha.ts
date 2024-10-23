import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { authMiddleware } from '../middlewares/auth';
import { addWonderspin } from '../api/gacha';

const router = express.Router();

router.post('/add_wonderspin', authMiddleware(3), async (req, res) => {
    const { name, ticketType, fortuneCrestThreshold, fortuneSurgeThreshold, fortuneBlessingThreshold, fortunePeakThreshold, assetData } = req.body;
    try {
        const { status, message, data } = await addWonderspin(name, ticketType, fortuneCrestThreshold, fortuneSurgeThreshold, fortuneBlessingThreshold, fortunePeakThreshold, assetData);

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

export default router;