import express from 'express';
import { placeBit } from '../api/raft';

const router = express.Router();

// temporarily without authentication for testing purposes
router.post('/place_bit', async (req, res) => {
    const { twitterId, bitId } = req.body;

    try {
        const { status, message, data } = await placeBit(twitterId, bitId);

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