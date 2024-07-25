import express from 'express';
import { ExtendedProfile } from '../../utils/types';
import { generateJWT, validateJWT } from '../../utils/jwt';
import { Status } from '../../utils/retVal';
import passport from '../../configs/passport';
import { getMainWallet, handleTwitterLogin } from '../../api/user';
import { mixpanel } from '../../utils/mixpanel';
import { TWITTER_LOGIN_CALLBACK_MIXPANEL_EVENT_HASH } from '../../utils/constants/mixpanelEvents';
import { WONDERBITS_CONTRACT } from '../../utils/constants/web3';
import { UserWallet } from '../../models/user';

const router = express.Router();

router.get('/login', async (req, res, next) => {
    // get the jwt token (if it exists) from the request headers
    const token = req.headers.authorization?.split(' ')[1];

    const host = req.query.host || 'https://x.com';
    (req.session as any).redirectHost = host;
    (req.session as any).version = req.query.version || '-';

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
            message: 'You denied the app or your session has expired. Please log in again.',
        });
    }

    try {
        // when logged in via twitter, `id` will be the user's twitter id
        const profile = req.user as ExtendedProfile;
        const { id: twitterId, twitterAccessToken, twitterRefreshToken, twitterExpiryDate } = profile;

        const { status, data, message } = await handleTwitterLogin(twitterId, false, profile);

        if (status !== Status.SUCCESS) {
            return res.status(status).json({
                status,
                message,
            });
        } else {
            const token = generateJWT(twitterId, twitterAccessToken, twitterRefreshToken, twitterExpiryDate - Math.floor(Date.now() / 1000));
            const host = (req.session as any).redirectHost || 'https://x.com';
            const version = (req.session as any).version || '-';

            if (status === Status.SUCCESS) {
                mixpanel.track('Login Callback', {
                    distinct_id: twitterId,
                    _accessToken: twitterAccessToken,
                    _refreshToken: twitterRefreshToken,
                    _expiryDate: twitterExpiryDate,
                    _origin: host,
                    _version: version,
                    _data: data,
                });

                // get the wallet address of the twitter ID
                // const { status: walletStatus, message: walletMessage, data: walletData } = await getMainWallet(twitterId);

                // if (walletStatus !== Status.SUCCESS) {
                //     // if there is an error somehow, ignore this and just return a success for the API endpoint
                //     // as this is just an optional tracking feature.
                //     return res.redirect(`${host}?jwt=${token}`);
                // }

                // const { address } = walletData.wallet as UserWallet;

                // // increment the counter for this mixpanel event on the wonderbits contract
                // await WONDERBITS_CONTRACT.incrementEventCounter(address, TWITTER_LOGIN_CALLBACK_MIXPANEL_EVENT_HASH).catch((err: any) => {
                //     // if there is an error somehow, ignore this and just return a success for the API endpoint
                //     // as this is just an optional tracking feature.
                //     // return res.redirect(`${host}?jwt=${token}`);
                //     console.error('Error incrementing event counter:', err);
                // });
            }

            return res.redirect(`${host}?jwt=${token}`);
        }
    } catch (err: any) {
        return res.status(500).json({
            status: Status.ERROR,
            message: err.message,
        });
    }
});

// used for external registration for a user in Wonderbits.
// e.g. use case = logging in from Wonderchamps and creating a new user in Wonderbits
router.post('/wonderbits_admin_registration', async (req, res) => {
    const { twitterId, adminCall, profile, adminKey } = req.body;

    try {
        if (!adminCall) {
            return res.status(401).json({
                status: Status.UNAUTHORIZED,
                message: `(wonderbits_admin_registration) Only admin calls are allowed. Please provide the admin key.`,
            });
        }

        if (adminCall && adminKey !== process.env.ADMIN_KEY) {
            return res.status(401).json({
                status: Status.UNAUTHORIZED,
                message: `(wonderbits_admin_registration) Invalid admin key.`,
            });
        }

        const { status, message, data } = await handleTwitterLogin(twitterId, adminCall, profile, adminKey);

        return res.status(status).json({
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

export default router;
