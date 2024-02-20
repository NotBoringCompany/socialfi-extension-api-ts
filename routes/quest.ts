import express from 'express';
import { addQuest } from '../api/quest';

const router = express.Router();

router.post('/add_quest', async (req, res) => {
    const {
        name,
        description,
        type,
        imageUrl,
        start,
        end,
        rewards,
        requirements,
        adminKey
    } = req.body;

    try {
        const { status, message, data } = await addQuest(
            name,
            description,
            type,
            imageUrl,
            start,
            end,
            rewards,
            requirements,
            adminKey
        );

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