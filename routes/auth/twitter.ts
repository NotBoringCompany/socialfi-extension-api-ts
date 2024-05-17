import express from 'express';
import { ExtendedProfile } from '../../utils/types';
import { generateJWT, validateJWT } from '../../utils/jwt';
import { Status } from '../../utils/retVal';
import passport from '../../configs/passport';
import { handleTwitterLogin } from '../../api/user';

const router = express.Router();

router.get('/login', async (req, res, next) => {
    // get the jwt token (if it exists) from the request headers
    const token = req.headers.authorization?.split(' ')[1];

    const host = req.query.host || 'https://x.com';
    (req.session as any).redirectHost = host;

    if (token) {
        // check for validation
        const { status } = validateJWT(token);
        if (status === Status.SUCCESS) {
            // token is valid, redirect to Twitter with the token
            return res.redirect(`${host}?jwt=${token}`);
        } else {
            // token is invalid, redirect to Twitter for authentication
            passport.authenticate('twitter', {
                scope: ['tweet.read', 'users.read', 'offline.access'],
                session: true,
                keepSessionInfo: true,
            })(req, res, next);
        }
    } else {
        // token doesn't exist, redirect to Twitter for authentication
        passport.authenticate('twitter', {
            scope: ['tweet.read', 'users.read', 'offline.access'],
            session: true,
            keepSessionInfo: true,
        })(req, res, next);
    }
});

router.get('/callback', passport.authenticate('twitter', { failureRedirect: '/', session: true, keepSessionInfo: true }), async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            status: Status.UNAUTHORIZED,
            message: 'You denied the app or your session has expired. Please log in again.'
        })
    }

    try {
        // when logged in via twitter, `id` will be the user's twitter id
        const profile = req.user as ExtendedProfile;
        const { id: twitterId, twitterAccessToken, twitterRefreshToken, twitterExpiryDate } = profile;

        const { status, message } = await handleTwitterLogin(twitterId, profile);

        if (status !== Status.SUCCESS) {
            return res.status(status).json({
                status,
                message
            })
        } else {
            const token = generateJWT(twitterId, twitterAccessToken, twitterRefreshToken, twitterExpiryDate - Math.floor(Date.now() / 1000));
            const host = (req.session as any).redirectHost || 'https://x.com';

            return res.redirect(`${host}?jwt=${token}`);
        }
    } catch (err: any) {
        return res.status(500).json({
            status: Status.ERROR,
            message: err.message
        })
    }
});

export default router;