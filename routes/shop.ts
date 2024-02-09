import express from 'express';
import { createShop, getShop } from '../api/shop';

const router = express.Router();

router.post('/create_shop', async (req, res) => {
    const { bitOrbs, terraCapsulators, foods, adminKey } = req.body;

    try {
        const { status, message, data } = await createShop(bitOrbs, terraCapsulators, foods, adminKey);

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

router.get('/get_shop', async (_, res) => {
    try {
        const { status, message, data } = await getShop();

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