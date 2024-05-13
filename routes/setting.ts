import express from 'express';
import { addSetting, getSettings } from '../api/setting';

const router = express.Router();

router.get('/get_settings', async (req, res) => {
    try {
        const { status, message, data } = await getSettings();

        return res.status(status).json({
            status,
            message,
            data,
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

router.post('/add_setting', async (req, res) => {
    const { key, name, description, value } = req.body;

    try {
        const { status, message, data } = await addSetting({ key, name, description, value });

        return res.status(status).json({
            status,
            message,
            data,
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

export default router;
