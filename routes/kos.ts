import express from 'express';
import { getOwnedKeyIDs } from '../api/kos';

const router = express.Router();

router.get('/get_owned_key_ids/:twitterId', async (req, res) => {
    const { twitterId } = req.params;
    try {
        const { status, message, data } = await getOwnedKeyIDs(twitterId);

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