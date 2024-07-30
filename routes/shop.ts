import express from 'express';
import { getShop, purchaseShopAsset } from '../api/shop';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { mixpanel } from '../utils/mixpanel';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { PURCHASE_SHOP_ASSET_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';
import { UserWallet } from '../models/user';
import { getMainWallet } from '../api/user';
import { incrementEventCounterInContract } from '../api/web3';

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

        if (status === Status.SUCCESS) {
            mixpanel.track('Currency Tracker', {
                distinct_id: validateData?.twitterId,
                '_type': 'Purchase Shop Asset',
                '_data': data,
            });

            incrementEventCounterInContract(validateData?.twitterId, PURCHASE_SHOP_ASSET_MIXPANEL_EVENT_HASH);
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