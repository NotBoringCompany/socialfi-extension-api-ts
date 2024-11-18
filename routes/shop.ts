import express from 'express';
import { addShopAssets, getShop, purchaseShopAsset } from '../api/shop';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { UserWallet } from '../models/user';


import { BitOrbType } from '../models/bitOrb';
import { incrementProgressionByType } from '../api/quest';
import { QuestRequirementType } from '../models/quest';
import { TerraCapsulatorType } from '../models/terraCapsulator';
import { authMiddleware } from '../middlewares/auth';

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

router.post('/purchase_shop_asset', async (req, res) => {
    const { 
        amount, 
        asset, 
        payment,
        address,
        chain,
        txHash
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

                // increment the event counter in the wonderbits contract.
                
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