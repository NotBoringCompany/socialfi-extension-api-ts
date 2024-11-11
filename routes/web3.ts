import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { incrementEventCounterInContract, updatePointsInContract } from '../api/web3';

const router = express.Router();

router.post('/update_points_in_contract', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'update_points_in_contract');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await updatePointsInContract(validateData?.twitterId);

        return res.status(status).json({
            status,
            message,
            data
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

router.post('/increment_event_counter_in_contract', async (req, res) => {
    const { mixpanelEventHash } = req.body;
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'increment_event_counter_in_contract');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await 

        return res.status(status).json({
            status,
            message,
            data
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

export default router;