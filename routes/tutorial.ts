import express from 'express';
import { getTutorials } from '../api/tutorial';

const router = express.Router();

router.get('/get_tutorials', async (req, res) => {
    try {
        const { status, message, data } = await getTutorials();

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