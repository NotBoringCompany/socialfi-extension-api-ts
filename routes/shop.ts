import express from 'express';
import { getShop, purchaseShopAsset } from '../api/shop';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { UserWallet } from '../models/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { getMainWallet } from '../api/user';
import { PURCHASE_SHOP_ASSET_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';

const router = express.Router();

router.get('/get_shop', async (_, res) => {
    try {
        const { status, message, data } = getShop();

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

router.post('/purchase_shop_asset', async (req, res) => {
    const { amount, asset } = req.body;

    console.log('jwt token: ', req.headers.authorization);

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'purchase_shop_asset');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await purchaseShopAsset(validateData?.twitterId, amount, asset);
        let incrementCounterTxHash = '';

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Currency Tracker', {
                distinct_id: validateData?.twitterId,
                '_type': 'Purchase Shop Asset',
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
                    data: {
                        ...data,
                        incrementCounterTxHash
                    }
                })
            }

            const { address } = walletData.wallet as UserWallet;

            // increment the counter for this mixpanel event on the wonderbits contract
            const incrementCounterTx = await WONDERBITS_CONTRACT.incrementEventCounter(address, PURCHASE_SHOP_ASSET_MIXPANEL_EVENT_HASH);
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