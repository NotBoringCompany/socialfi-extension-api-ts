import express from 'express';
import { evolveBit, evolveBitInRaft, feedBit, getBits } from '../api/bit';
import { FoodType } from '../models/food';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';

const router = express.Router();

router.post('/evolve_bit_in_raft', async (req, res) => {
    const { bitId } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'evolve_bit_in_raft');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await evolveBitInRaft(validateData?.twitterId, bitId);

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

router.post('/evolve_bit', async (req, res) => {
    const { bitId } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'evolve_bit');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await evolveBit(validateData?.twitterId, bitId);

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

router.post('/feed_bit', async (req, res) => {
    const { bitId, foodType } = req.body;

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'feed_bit');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    try {
        const { status, message, data } = await feedBit(validateData?.twitterId, bitId, <FoodType>foodType);

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

router.get('/get_bits', async (req, res) => {
    const bitIdsParam = req.query.bitIds as string;

    // convert string to array
    const bitIds = bitIdsParam.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

    try {
        const { status, message, data } = await getBits(bitIds);

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
