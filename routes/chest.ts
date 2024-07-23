import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { openChest } from '../api/chest';
import { mixpanel } from '../utils/mixpanel';
import { OPEN_CHEST_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { UserWallet } from '../models/user';
import { getMainWallet } from '../api/user';
import { checkWonderbitsAccountRegistrationRequired } from '../api/web3';

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

        if (status === Status.SUCCESS) {
            mixpanel.track('Open Chest', {
                distinct_id: validateData?.twitterId,
                '_tweetId': tweetId,
                '_data': data,
            });

            // get the wallet address of the twitter ID
            const { status: walletStatus, message: walletMessage, data: walletData } = await getMainWallet(validateData?.twitterId);

            if (walletStatus !== Status.SUCCESS) {
                // if there is an error somehow, ignore this and just return a success for the API endpoint
                // as this is just an optional tracking feature.
                return res.status(status).json({
                    status,
                    message,
                    data
                })
            }

            const { address } = walletData.wallet as UserWallet;

            // check if the user has an account registered in the contract.
            const { status: wonderbitsAccStatus } = await checkWonderbitsAccountRegistrationRequired(address);

            if (wonderbitsAccStatus !== Status.SUCCESS) {
                // if there is an error somehow, ignore this and just return a success for the API endpoint
                // as this is just an optional tracking feature.
                return res.status(status).json({
                    status,
                    message,
                    data
                })
            }

            // increment the counter for this mixpanel event on the wonderbits contract
            await WONDERBITS_CONTRACT.incrementEventCounter(address, OPEN_CHEST_MIXPANEL_EVENT_HASH).catch((err: any) => {
                // if there is an error somehow, ignore this and just return a success for the API endpoint
                // as this is just an optional tracking feature.
                return res.status(status).json({
                    status,
                    message,
                    data
                })
            })
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