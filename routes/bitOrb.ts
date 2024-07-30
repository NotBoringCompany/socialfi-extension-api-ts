import express from 'express';
import { consumeBitOrb } from '../api/bitOrb';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { mixpanel } from '../utils/mixpanel';
import { getMainWallet } from '../api/user';
import { CONSUME_BIT_ORB_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { UserWallet } from '../models/user';
import { incrementEventCounterInContract } from '../api/web3';

const router = express.Router();

router.post('/consume', async (req, res) => {
    const { type } = req.body;
    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'consume_bit_orb');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }
        const { status, message, data } = await consumeBitOrb(
            validateData?.twitterId,
            type
        );

        if (status === Status.SUCCESS) {
            mixpanel.track('Consume Bit Orb', {
                distinct_id: validateData?.twitterId,
                '_type': type,
                '_bit': data?.bit,
            });

            incrementEventCounterInContract(validateData?.twitterId, CONSUME_BIT_ORB_MIXPANEL_EVENT_HASH);
        }

        return res.status(status).json({
            status,
            message,
            data,
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

export default router;
