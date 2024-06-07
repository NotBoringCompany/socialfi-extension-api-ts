import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { depositCookies, withdrawCookies } from '../api/cookie';
import { mixpanel } from '../utils/mixpanel';

const router = express.Router();

router.post('/deposit', async (req, res) => {
    const { amount } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'deposit');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await depositCookies(validateData?.twitterId, amount);

        if (status === Status.SUCCESS) {
            mixpanel.track('Deposit Cookies', {
                distinct_id: validateData?.twitterId,
                '_data': data,
            });
        }

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
})

router.post('/withdraw', async (req, res) => {
    const { amount } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'withdraw');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await withdrawCookies(validateData?.twitterId, amount);

        if (status === Status.SUCCESS) { 
            mixpanel.track('Withdraw Cookies', {
                distinct_id: validateData?.twitterId,
                '_data': data,
            });
        }

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
})

export default router;