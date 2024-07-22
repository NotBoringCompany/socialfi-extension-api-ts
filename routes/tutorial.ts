import express from 'express';
import { completeTutorial, getTutorials } from '../api/tutorial';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';
import mixpanel from 'mixpanel';
import { UserWallet } from '../models/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { TUTORIAL_COMPLETED_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';
import { getMainWallet } from '../api/user';

const router = express.Router();

router.get('/get_tutorials', async (req, res) => {
    try {
        const { status, message, data } = await getTutorials();

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

router.post('/complete_tutorial', async (req, res) => {
    const { tutorialId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'complete_tutorial');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await completeTutorial(validateData?.twitterId, tutorialId);
        let incrementCounterTxHash = '';

        if (status === Status.SUCCESS && tutorialId === 11) {
            mixpanel.track('Tutorial Completed', {
                distinct_id: validateData?.twitterId,
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
            const incrementCounterTx = await WONDERBITS_CONTRACT.incrementEventCounter(address, TUTORIAL_COMPLETED_MIXPANEL_EVENT_HASH);
            incrementCounterTxHash = incrementCounterTx.hash;
        }

        return res.status(status).json({
            status,
            message,
            data: {
                ...data,
                incrementCounterTxHash
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

export default router;