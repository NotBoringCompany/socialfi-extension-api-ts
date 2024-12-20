import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { openChest } from '../api/chest';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { getMainWallet } from '../api/user';
import { UserWallet } from '../models/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';

const router = express.Router();

router.post('/open_chest', async (req, res) => {
    const { tweetId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'open_chest');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await openChest(validateData?.twitterId, tweetId);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Open Chest', {
                distinct_id: validateData?.twitterId,
                '_tweetId': tweetId,
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