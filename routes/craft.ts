import express from 'express';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';
import { doCraft } from '../api/craft';

const router = express.Router();

router.post('/do_craft', async (req, res) => {
    const { resType, amt } = req.body;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'do_craft');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        //const { status, message, data } = await feedBit(validateData?.twitterId, bitId, <FoodType>foodType);
        const { status, message, data } = await doCraft(validateData?.twitterId, resType, amt);
        

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