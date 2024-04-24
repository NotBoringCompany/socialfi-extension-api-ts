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

    if (token) {
        // check for validation
        const { status } = validateJWT(token);
        if (status === Status.SUCCESS) {
            // token is valid, redirect to Twitter with the token
            return res.redirect(`https://twitter.com?jwt=${token}`);
        } else {
            // token is invalid, redirect to Twitter for authentication
            passport.authenticate('twitter', {
                scope: ['tweet.read', 'users.read', 'offline.access']
            })(req, res, next);
        }
    } else {
        // token doesn't exist, redirect to Twitter for authentication
        passport.authenticate('twitter', {
            scope: ['tweet.read', 'users.read', 'offline.access']
        })(req, res, next);
    }
});

router.get('/callback', passport.authenticate('twitter', { failureRedirect: '/' }), async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            status: Status.UNAUTHORIZED,
            message: 'You denied the app or your session has expired. Please log in again.'
        })
    }

    try {
        console.log('req user via callback: ', req.user);

        // when logged in via twitter, `id` will be the user's twitter id
        const { id: twitterId, twitterAccessToken, twitterRefreshToken, twitterExpiryDate, photos } = req.user as ExtendedProfile;

        console.log('user photo values: ', photos[0]);
        
        const { status, message } = await handleTwitterLogin(twitterId, photos?.values[0] ?? '');

        if (status !== Status.SUCCESS) {
            return res.status(status).json({
                status,
                message
            })
        } else {
            const token = generateJWT(twitterId, twitterAccessToken, twitterRefreshToken, twitterExpiryDate - Math.floor(Date.now() / 1000));

            return res.redirect(`https://twitter.com?jwt=${token}`);
        }
    } catch (err: any) {
        return res.status(500).json({
            status: Status.ERROR,
            message: err.message
        })
    }
});

export default router;