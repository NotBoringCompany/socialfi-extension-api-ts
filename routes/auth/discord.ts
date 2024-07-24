import express from 'express';
import { ExtendedDiscordProfile } from '../../utils/types';
import { Status } from '../../utils/retVal';
import passport from '../../configs/passport';
import { connectToDiscord, disconnectFromDiscord, getMainWallet } from '../../api/user';
import { validateJWT } from '../../utils/jwt';
import { validateRequestAuth } from '../../utils/auth';
import { mixpanel } from '../../utils/mixpanel';
import { UserWallet } from '../../models/user';
import { CONNECT_DISCORD_CALLBACK_MIXPANEL_EVENT_HASH, DISCONNECT_DISCORD_MIXPANEL_EVENT_HASH } from '../../utils/constants/mixpanelEvents';
import { WONDERBITS_CONTRACT } from '../../utils/constants/web3';
import { checkWonderbitsAccountRegistrationRequired } from '../../api/web3';

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

        // store the target URL and token in the session for later use
        (req.session as any).target = req.query.target || 'https://twitter.com'; // target is the redirect URL that will be used later in the callback
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
        const target = new URL((req.session as any).target || 'https://twitter.com');

        const { status, message, data } = await connectToDiscord(validateData?.twitterId, profile);
        if (status !== Status.SUCCESS) {
            // send a failed message to be read later on the frontend
            target.searchParams.append(
                'state',
                JSON.stringify({
                    message: {
                        type: 'authorization_failed',
                        value: message,
                    },
                    target,
                })
            );
            return res.redirect(target.href);
        }

        // send a successful message
        target.searchParams.append(
            'state',
            JSON.stringify({
                message: {
                    type: 'authorization_successful',
                    value: data,
                },
                target,
            })
        );

        if (status === Status.SUCCESS) {
            mixpanel.track('Connect Discord Callback', {
                distinct_id: validateData?.twitterId,
                '_profile': profile,
            });

            // get the wallet address of the twitter ID
            const { status: walletStatus, message: walletMessage, data: walletData } = await getMainWallet(validateData?.twitterId);

            if (walletStatus !== Status.SUCCESS) {
                // if there is an error somehow, ignore this and just redirect.
                // as this is just an optional tracking feature.
                return res.redirect(target.href);
            }

            const { address } = walletData.wallet as UserWallet;

            // check if the user has an account registered in the contract.
            const { status: wonderbitsAccStatus } = await checkWonderbitsAccountRegistrationRequired(address);

            if (wonderbitsAccStatus !== Status.SUCCESS) {
                // if there is an error somehow, ignore this and just return a success for the API endpoint
                // as this is just an optional tracking feature.
                return res.redirect(target.href);
            }

            // increment the counter for this mixpanel event on the wonderbits contract
            await WONDERBITS_CONTRACT.incrementEventCounter(address, CONNECT_DISCORD_CALLBACK_MIXPANEL_EVENT_HASH).catch((err: any) => {
                // if there is an error somehow, ignore this and just redirect.
                // as this is just an optional tracking feature.
                return res.redirect(target.href);
            })
        }

        return res.redirect(target.href);
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

        if (status === Status.SUCCESS) {
            mixpanel.track('Disconnect Discord', {
                distinct_id: validateData?.twitterId,
                '_data': data
            });

            // get the wallet address of the twitter ID
            const { status: walletStatus, message: walletMessage, data: walletData } = await getMainWallet(validateData?.twitterId);

            if (walletStatus === Status.SUCCESS) {
                const { address } = walletData.wallet as UserWallet;

                // check if the user has an account registered in the contract.
                const { status: wonderbitsAccStatus } = await checkWonderbitsAccountRegistrationRequired(address);

                if (wonderbitsAccStatus === Status.SUCCESS) {
                    // increment the counter for this mixpanel event on the wonderbits contract
                    await WONDERBITS_CONTRACT.incrementEventCounter(address, DISCONNECT_DISCORD_MIXPANEL_EVENT_HASH).catch((err: any) => {
                        console.error('Error incrementing event counter:', err);
                        // Logging the error but not altering the response
                    });
                }
            }
        }

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
