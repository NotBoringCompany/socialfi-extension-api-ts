import express from 'express';
import { getShop, purchaseShopAsset } from '../api/shop';

const router = express.Router();

router.get('/get_shop', async (_, res) => {
    try {
        const { status, message, data } = getShop();

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
router.post('/purchase_shop_asset', async (req, res) => {
    const { twitterId, asset, foodType } = req.body;

    try {
        const { status, message, data } = await purchaseShopAsset(twitterId, asset, foodType);

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