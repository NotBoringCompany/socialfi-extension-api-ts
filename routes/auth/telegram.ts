import express from 'express';
import { Status } from '../../utils/retVal';
import { handleTelegramLogin, updateLoginStreak } from '../../api/user';
import { generateJWT } from '../../utils/jwt';
import { parseTelegramData } from '../../utils/telegram';

const router = express.Router();

router.post('/login', async (req, res, next) => {
    const { initData } = req.body;
    if (!initData) {
        return res.status(Status.UNAUTHORIZED).json({
            status: Status.UNAUTHORIZED,
            message: `(connect) No init data provided.`,
        });
    }

    try {
        const { data, message, status } = await handleTelegramLogin(initData);
        if (status !== Status.SUCCESS) {
            return res.status(status).json({
                status: status,
                message,
            });
        }

        const telegramData = parseTelegramData(initData);

        const token = generateJWT(data.twitterId, telegramData.hash, telegramData.hash, Date.now() * 2);

        // update user's login streak ingame data
        updateLoginStreak(data.twitterId);

        return res.status(Status.SUCCESS).json({
            status: Status.SUCCESS,
            data: {
                data,
                token,
            },
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

export default router;
