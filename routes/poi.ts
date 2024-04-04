import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { addPoi, travelToPOI } from '../api/poi';

const router = express.Router();

router.post('/add_poi', async (req, res) => {
    const { name, distanceTo, shop, adminKey } = req.body;

    try {
        const { status: validateStatus, message: validateMessage } = await validateRequestAuth(req, res, 'add_poi');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message } = await addPoi(name, distanceTo, shop, adminKey);

        return res.status(status).json({
            status,
            message
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

router.post('/travel_to_poi', async (req, res) => {
    const { destination } = req.body;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'travel_to_poi');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message } = await travelToPOI(validateData?.twitterId, destination);

        return res.status(status).json({
            status,
            message
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

export default router;