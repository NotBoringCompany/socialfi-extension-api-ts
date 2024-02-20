import express from 'express';
import { evolveBit, evolveBitInRaft, feedBit } from '../api/bit';
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
})

export default router;
