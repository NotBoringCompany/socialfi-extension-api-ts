import express from 'express';
import { ExtendedProfile } from '../../utils/types';
import { generateJWT, validateJWT } from '../../utils/jwt';
import { Status } from '../../utils/retVal';
import passport from '../../configs/passport';
import { handleTwitterLogin } from '../../api/user';
import { v4 } from 'uuid';
import { decrypt, encrypt } from '../../utils/crypto';

const router = express.Router();

router.get('/login', async (req, res, next) => {
    // get the jwt token (if it exists) from the request headers
    const token = req.headers.authorization?.split(' ')[1];

    // get the referral and/or starter code from the query params
    const { referralCode, starterCode } = req.query;

    console.log('referral code from /login:', referralCode);
    console.log('starter code from /login:', starterCode);

    const statePayload = JSON.stringify({
        referralCode,
        starterCode,
        nonce: v4(),
        timestamp: Math.floor(Date.now() / 1000)
    });

    const state = encrypt(statePayload);

    console.log('state: ', state);

    if (token) {
        console.log('token exists: ', token);

        // check for validation
        const { status } = validateJWT(token);
        if (status === Status.SUCCESS) {
            // token is valid, redirect to Twitter with the token
            return res.redirect(`https://twitter.com?jwt=${token}`);
        } else {
            console.log('token is invalid from login. redirecting to twitter for authentication');
            
            // token is invalid, redirect to Twitter for authentication
            passport.authenticate('twitter', {
                scope: ['tweet.read', 'users.read', 'offline.access'],
                state
            })(req, res, next);
        }
    } else {
        console.log('token doesnt exist, redirecting to twitter for authentication from /login');

        // token doesn't exist, redirect to Twitter for authentication
        passport.authenticate('twitter', {
            scope: ['tweet.read', 'users.read', 'offline.access'],
            state
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

    const encryptedState = req.query.state as string;
    const statePayload = JSON.parse(decrypt(encryptedState));
    const { referralCode, starterCode, nonce, timestamp } = statePayload;

    console.log('referral code in callback:', referralCode);
    console.log('starter code in callback:', starterCode);
    console.log('nonce in callback:', nonce);
    console.log('timestamp in callback:', timestamp);

    try {
        // when logged in via twitter, `id` will be the user's twitter id
        const { id: twitterId, twitterAccessToken, twitterRefreshToken, twitterExpiryDate } = req.user as ExtendedProfile;

        const { status, message } = await handleTwitterLogin(twitterId, starterCode, referralCode);

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