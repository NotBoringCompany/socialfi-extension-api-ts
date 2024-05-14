import express from 'express';
import { ExtendedDiscordProfile } from '../../utils/types';
import { Status } from '../../utils/retVal';
import passport from '../../configs/passport';
import { connectToDiscord, disconnectFromDiscord } from '../../api/user';
import { validateJWT } from '../../utils/jwt';
import { validateRequestAuth } from '../../utils/auth';

const router = express.Router();

router.get('/connect', async (req, res, next) => {
    const { token } = req.query;
    if (!token) {
        return res.status(Status.UNAUTHORIZED).json({
            status: Status.UNAUTHORIZED,
            message: `(connect) No token provided.`,
        });
    }

    try {
        const { status, message } = validateJWT(token.toString());
        if (status !== Status.SUCCESS) {
            return res.status(status).json({
                status: status,
                message,
            });
        }

        (req.session as any).token = token;

        passport.authenticate('discord', {
            scope: ['identify', 'role_connections.write'],
            session: true,
            keepSessionInfo: true,
        })(req, res, next);
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

router.get('/callback', passport.authenticate('discord', { failureRedirect: '/', session: true, keepSessionInfo: true }), async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            status: Status.UNAUTHORIZED,
            message: 'You denied the app or your session has expired. Please log in again.',
        });
    }

    try {
        const token = (req.session as any).token;
        if (!token) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(connect) No token provided.`,
            };
        }

        const { status: validateStatus, message: validateMessage, data: validateData } = validateJWT(token);
        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const profile = req.user as ExtendedDiscordProfile;

        const { status, message, data } = await connectToDiscord(validateData?.twitterId, profile);
        if (status !== Status.SUCCESS) {
            return res.status(status).json({
                status,
                message,
            });
        }

        return res.status(Status.SUCCESS).json({
            status,
            message,
            data,
        });
    } catch (err: any) {
        return res.status(500).json({
            status: Status.ERROR,
            message: err.message,
        });
    }
});

router.post('/disconnect', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'disconnect');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await disconnectFromDiscord(validateData?.twitterId);

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
