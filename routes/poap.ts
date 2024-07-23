import express from 'express';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';
import { addPOAP, getAllPOAP, getUserPOAP, redeemCode } from '../api/poap';
import { mixpanel } from '../utils/mixpanel';
import { UserWallet } from '../models/user';
import { getMainWallet } from '../api/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { REDEEM_POAP_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';
import { checkWonderbitsAccountRegistrationRequired } from '../api/web3';

const router = express.Router();

router.post('/add_poap', async (req, res) => {
    try {
        const { status, message, data } = await addPOAP(req.body);

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

router.get('/get_poap', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage } = await validateRequestAuth(req, res, 'get_poap');
        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await getAllPOAP();

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

router.get('/get_user_poap', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_user_poap');
        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await getUserPOAP(validateData.twitterId);

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

router.post('/redeem_poap', async (req, res) => {
    const { code } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'redeem_poap');
        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await redeemCode(validateData.twitterId, code);

        if (status === Status.SUCCESS) {
            mixpanel.track('Redeem POAP', {
                distinct_id: validateData?.twitterId,
                '_code': code,
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
            await WONDERBITS_CONTRACT.incrementEventCounter(address, REDEEM_POAP_MIXPANEL_EVENT_HASH).catch((err: any) => {
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
