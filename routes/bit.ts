import express from 'express';
import { evolveBit, evolveBitInRaft, feedBit, getBits } from '../api/bit';
import { FoodType } from '../models/food';

const router = express.Router();

// temporarily without authentication for testing purposes
router.post('/evolve_bit_in_raft', async (req, res) => {
    const { twitterId, bitId } = req.body;

    try {
        const { status, message, data } = await evolveBitInRaft(twitterId, bitId);

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

// temporarily without authentication for testing purposes
router.post('/evolve_bit', async (req, res) => {
    const { twitterId, bitId } = req.body;

    try {
        const { status, message, data } = await evolveBit(twitterId, bitId);

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

// temporarily without authentication for testing purposes
router.post('/feed_bit', async (req, res) => {
    const { twitterId, bitId, foodType } = req.body;

    try {
        const { status, message, data } = await feedBit(twitterId, bitId, <FoodType>foodType);

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
