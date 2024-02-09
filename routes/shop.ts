import express from 'express';
import { createShop } from '../api/shop';

const router = express.Router();

router.post('/create_shop', async (req, res) => {
    const { shopBitOrbs, shopTerraCapsulators, shopFoods, adminKey } = req.body;

    try {
        const { status, message, data } = await createShop(shopBitOrbs, shopTerraCapsulators, shopFoods, adminKey);

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