import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { universalAssetUpgrade } from '../api/upgrade';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';

const router = express.Router();

router.post('/universal_asset_upgrade', async (req, res) => {
    const { asset, upgradeCostGroup, chosenFlexibleRequiredAssets, islandOrBitId, poi } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'universal_asset_upgrade');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await universalAssetUpgrade(validateData?.twitterId, asset, upgradeCostGroup, chosenFlexibleRequiredAssets, islandOrBitId);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Currency Tracker', {
                distinct_id: validateData?.twitterId,
                '_type': `Upgrade ${asset}`,
                '_data': data
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