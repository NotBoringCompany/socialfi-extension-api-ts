import express from 'express';
import { getInventory } from '../api/user';

const router = express.Router();

// temporarily without authentication for testing purposes
router.get('/get_inventory/:twitterId', async (req, res) => {
    const { twitterId } = req.params;

    try {
        const { status, message, data } = await getInventory(twitterId);

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