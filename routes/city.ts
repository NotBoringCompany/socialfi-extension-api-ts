import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { addCity } from '../api/city';

const router = express.Router();

router.post('/add_city', async (req, res) => {
    const { name, distanceTo, shop, adminKey } = req.body;

    try {
        const { status: validateStatus, message: validateMessage } = await validateRequestAuth(req, res, 'add_city');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message } = await addCity(name, distanceTo, shop, adminKey);

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