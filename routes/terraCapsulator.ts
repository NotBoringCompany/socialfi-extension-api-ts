import express from 'express';
import { consumeTerraCapsulator } from '../api/terraCapsulator';

const router = express.Router();

// temporarily without authentication for testing purposes
router.post('/consume', async (req, res) => {
    const { twitterId } = req.body;

    try {
        const { status, message, data } = await consumeTerraCapsulator(twitterId);

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