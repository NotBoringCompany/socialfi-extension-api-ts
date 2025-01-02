import express from 'express';
import { Status } from '../../utils/retVal';
import { handleAddressLogin, updateLoginStreak } from '../../api/user';
import { generateJWT } from '../../utils/jwt';

const router = express.Router();

router.post('/login', async (req, res, next) => {
    const { address, message, signature } = req.body;

    try {
        const loginResult = await handleAddressLogin(address, message, signature);
        if (loginResult.status !== Status.SUCCESS) {
            console.log(`(auth/kaia) loginResult error: ${JSON.stringify(loginResult)}`);

            return res.status(loginResult.status).json(loginResult);
        }

        const token = generateJWT(loginResult.data.twitterId, signature, signature, Date.now() * 2);

        // update user's login streak ingame data
        updateLoginStreak(loginResult.data.twitterId);

        return res.status(Status.SUCCESS).json({
            status: Status.SUCCESS,
            data: {
                data: loginResult.data,
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
