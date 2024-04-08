import express from 'express';
import { items } from '../utils/constants/item';

const router = express.Router();

router.get('/get_item_descriptions', async (req, res) => {
    try {
        return res.status(200).json({
            status: 200,
            message: 'Item descriptions retrieved successfully.',
            data: {
                items
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