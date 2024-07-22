import express from 'express';
import { consumeBitOrb } from '../api/bitOrb';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { UserWallet } from '../models/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { CONSUME_BIT_ORB_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';
import { getMainWallet } from '../api/user';

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
        let incrementCounterTxHash = '';

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Consume Bit Orb', {
                distinct_id: validateData?.twitterId,
                '_type': type,
                '_bit': data?.bit,
            });

            // get the wallet address of the twitter ID
            const { status: walletStatus, message: walletMessage, data: walletData } = await getMainWallet(validateData?.twitterId);

            if (walletStatus !== Status.SUCCESS) {
                // if there is an error somehow, ignore this and just return a success for the API endpoint
                // as this is just an optional tracking feature.
                return res.status(status).json({
                    status,
                    message,
                    data: {
                        ...data,
                        incrementCounterTxHash
                    }
                })
            }

            const { address } = walletData.wallet as UserWallet;

            // increment the counter for this mixpanel event on the wonderbits contract
            const incrementCounterTx = await WONDERBITS_CONTRACT.incrementEventCounter(address, CONSUME_BIT_ORB_MIXPANEL_EVENT_HASH);
            incrementCounterTxHash = incrementCounterTx.hash;
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
