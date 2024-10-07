import express from 'express';
import { assets } from '../utils/constants/asset';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { consumeSynthesizingItem } from '../api/asset';

const router = express.Router();

router.get('/get_asset_descriptions', async (req, res) => {
    try {
        return res.status(200).json({
            status: 200,
            message: 'Asset descriptions retrieved successfully.',
            data: {
                assets
            }
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
});

router.post('/consume_synthesizing_item', async (req, res) => {
    const { item, islandOrBitId, newResourceLine, chosenBitTraitsToReroll } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'consume_synthesizing_item');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await consumeSynthesizingItem(validateData?.twitterId, item, islandOrBitId, newResourceLine, chosenBitTraitsToReroll);

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

export default router;