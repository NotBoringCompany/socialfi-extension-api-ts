import express from 'express';
import { addShopAssets, getShop, purchaseShopAsset, purchaseShopAssetPrerequisitesCheck, sendTelegramStarsInvoice } from '../api/shop';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { UserWallet } from '../models/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { getMainWallet } from '../api/user';
import { incrementProgressionByType } from '../api/quest';
import { QuestRequirementType } from '../models/quest';
import { authMiddleware } from '../middlewares/auth';
import { BitOrbType, TerraCapsulatorType } from '../models/item';

const router = express.Router();

router.get('/get_shop', async (_, res) => {
    try {
        const { status, message, data } = await getShop();

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

router.post('/add_shop_assets', authMiddleware(3), async (req, res) => {
    const { assets } = req.body;

    try {
        await addShopAssets(assets);

        return res.status(200).json({
            status: Status.SUCCESS,
            message: `Successfully added ${assets.length} assets to the shop.`
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

router.post('/purchase_shop_asset_prerequisites_check', async (req, res) => {
    const { asset, amount } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'purchase_shop_asset_prerequisites_check');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await purchaseShopAssetPrerequisitesCheck(validateData?.twitterId, asset, amount);

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

router.post('/send_telegram_stars_invoice', async (req, res) => {
    const { asset, chatId } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'send_telegram_stars_invoice');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await sendTelegramStarsInvoice(asset, chatId);

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
    const { 
        amount, 
        asset, 
        payment,
        address,
        chain,
        txHash,
    } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'purchase_shop_asset');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await purchaseShopAsset(
            validateData?.twitterId, 
            amount, 
            asset, 
            payment,
            address,
            chain,
            txHash
        );

        if (status === Status.SUCCESS) {
            if (allowMixpanel) {
                mixpanel.track('Currency Tracker', {
                    distinct_id: validateData?.twitterId,
                    '_type': 'Purchase Shop Asset',
                    '_data': data,
                });
            }


            if (asset === BitOrbType.BIT_ORB_I || asset === BitOrbType.BIT_ORB_II || asset === BitOrbType.BIT_ORB_III) {
                incrementProgressionByType(QuestRequirementType.PURCHASE_ORB, validateData?.twitterId, Number(amount));
            }
            if (asset === TerraCapsulatorType.TERRA_CAPSULATOR_I || asset === TerraCapsulatorType.TERRA_CAPSULATOR_II) {
                incrementProgressionByType(QuestRequirementType.PURCHASE_CAPSULE, validateData?.twitterId, Number(amount));
            }

            incrementProgressionByType(QuestRequirementType.PURCHASE_ITEM, validateData?.twitterId, Number(amount));
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