import express from 'express';
import { consumeTerraCapsulator } from '../api/terraCapsulator';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { mixpanel } from '../utils/mixpanel';

const router = express.Router();

router.post('/consume', async (req, res) => {
    const { type } = req.body;
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'consume_terra_capsulator');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await consumeTerraCapsulator(type, validateData?.twitterId);

        if (status === Status.SUCCESS) {
            mixpanel.track('Consume Terra Capsulator', {
                distinct_id: validateData?.twitterId,
                '_type': type,
                '_island': data?.island,
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
});

export default router;