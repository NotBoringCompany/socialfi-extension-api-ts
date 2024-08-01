import express from 'express';
import { Status } from '../../utils/retVal';
import { handleTelegramLogin, linkInviteCode, updateLoginStreak } from '../../api/user';
import { generateJWT } from '../../utils/jwt';
import { parseTelegramData, validateTelegramData } from '../../utils/telegram';

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
        // validate the init data
        const isValid = validateTelegramData(initData);
        if (!isValid)
            return {
                status: Status.UNAUTHORIZED,
                message: `(handleTelegramLogin) Unauthorized`,
            };

        const telegramData = parseTelegramData(initData);

        const { data, message, status } = await handleTelegramLogin(telegramData.user);
        if (status !== Status.SUCCESS) {
            return res.status(status).json({
                status: status,
                message,
            });
        }

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

router.post('/register', async (req, res) => {
    const { token, user, referral } = req.body;

    try {
        if (!token || token !== process.env.TELEGRAM_BOT_TOKEN) {
            return res.status(Status.UNAUTHORIZED).json({
                status: Status.UNAUTHORIZED,
                message: `(telegramRegister) Unauthorized`,
            });
        }

        const { data, message, status } = await handleTelegramLogin({
            id: user.id,
            first_name: user.first_name,
            last_name: user?.last_name ?? '',
            username: user.username,
            allows_write_to_pm: true,
            language_code: '',
        });
        if (status !== Status.SUCCESS) {
            return res.status(status).json({
                status: status,
                message,
            });
        }

        if (referral && data.loginType === 'Register') {
            await linkInviteCode(data.twitterId, referral);
        }

        return res.status(Status.SUCCESS).json({
            status: Status.SUCCESS,
            data: null,
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

export default router;
