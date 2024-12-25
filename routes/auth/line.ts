import express from 'express';
import { Status } from '../../utils/retVal';
import { handleLineLogin, updateLoginStreak } from '../../api/user';
import { generateJWT } from '../../utils/jwt';
import { getLineProfile, verifyLineToken } from '../../api/line';

const router = express.Router();

router.post('/login', async (req, res, next) => {
    const { accessToken } = req.body;
    if (!accessToken) {
        return res.status(Status.UNAUTHORIZED).json({
            status: Status.UNAUTHORIZED,
            message: `(login) No access token provided.`,
        });
    }

    try {
        // validate the access token
        const tokenResult = await verifyLineToken(accessToken);
        if (tokenResult.status !== Status.SUCCESS) {
            return res.status(tokenResult.status).json(tokenResult);
        }

        // get user's profile
        const profileResult = await getLineProfile(accessToken);
        if (profileResult.status !== Status.SUCCESS) {
            return res.status(profileResult.status).json(profileResult);
        }

        const loginResult = await handleLineLogin(profileResult.data);
        if (loginResult.status !== Status.SUCCESS) {
            return res.status(loginResult.status).json(loginResult);
        }

        const token = generateJWT(loginResult.data.twitterId, accessToken, accessToken, Date.now() * 2);

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
