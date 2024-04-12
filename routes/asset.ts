import express from 'express';
import { assets } from '../utils/constants/asset';

const router = express.Router();

router.get('/get_asset_descriptions', async (req, res) => {
    try {
        return res.status(200).json({
            status: 200,
            message: 'Asset descriptions retrieved successfully.',
            data: {
                assets
            }
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})
export default router;