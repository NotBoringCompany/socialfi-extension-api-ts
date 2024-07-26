import express from 'express';
import { claimDailyKOSRewards, claimWeeklyKOSRewards, getClaimableDailyKOSRewards, getClaimableWeeklyKOSRewards, getOwnedKeyIDs, getOwnedKeychainIDs, getOwnedSuperiorKeychainIDs } from '../api/kos';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';
import { mixpanel } from '../utils/mixpanel';
import { validate } from 'node-cron';

const router = express.Router();

router.get('/get_owned_key_ids/:twitterId', async (req, res) => {
    const { twitterId } = req.params;
    try {
        const { status, message, data } = await getOwnedKeyIDs(twitterId);

        if (status === Status.SUCCESS) {
            mixpanel.track('User Owned Key', {
                distinct_id: twitterId,
                '_ownedKey': data?.ownedKeyIDs.length,
                '_ownedKeyIds': data?.ownedKeyIDs,
            });
        }

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
});

router.get('/get_owned_keychain_ids/:twitterId', async (req, res) => {
    const { twitterId } = req.params;
    try {
        const { status, message, data } = await getOwnedKeychainIDs(twitterId);

        if (status === Status.SUCCESS) {
            mixpanel.track('User Owned Keychain', {
                distinct_id: twitterId,
                '_ownedKeychain': data?.ownedKeychainIDs.length,
                '_ownedKeychainIds': data?.ownedKeychainIDs,
            });
        }

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
});

router.get('/get_owned_superior_keychain_ids/:twitterId', async (req, res) => {
    const { twitterId } = req.params;
    try {
        const { status, message, data } = await getOwnedSuperiorKeychainIDs(twitterId);

        if (status === Status.SUCCESS) {
            mixpanel.track('User Owned Superior Keychain', {
                distinct_id: twitterId,
                '_data': data,
                '_ownedSuperiorKeychain': data?.ownedSuperiorKeychainIDs.length,
                '_ownedSuperiorKeychainIds': data?.ownedSuperiorKeychainIDs,
            });
        }

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

router.post('/claim_daily_kos_rewards', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_daily_kos_rewards');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await claimDailyKOSRewards(validateData?.twitterId);

        if (status === Status.SUCCESS) {
            mixpanel.track('Claim Daily KOS', {
                distinct_id: validateData?.twitterId,
                '_data': data,
            });
        }

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
});

router.post('/claim_weekly_kos_rewards', async (req, res) => {
    try {
        throw new Error(`(╯°□°）╯︵ ┻━┻ Sorry! We've temporarily disabled this function.`);
        // const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_weekly_kos_rewards');

        // if (validateStatus !== Status.SUCCESS) {
        //     return res.status(validateStatus).json({
        //         status: validateStatus,
        //         message: validateMessage
        //     })
        // }

        // const { status, message, data } = await claimWeeklyKOSRewards(validateData?.twitterId);

        // if (status === Status.SUCCESS) {
        //     mixpanel.track('Claim Weekly KOS', {
        //         distinct_id: validateData?.twitterId,
        //         '_data': data,
        //     });
        // }

        // return res.status(status).json({
        //     status,
        //     message,
        //     data
        // });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
});

router.get('/get_claimable_daily_kos_rewards', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_daily_kos_rewards');
        const { status, message, data } = await getClaimableDailyKOSRewards(validateData?.twitterId);

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
});

router.get('/get_claimable_weekly_kos_rewards', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_weekly_kos_rewards');
        const { status, message, data } = await getClaimableWeeklyKOSRewards(validateData?.twitterId);

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

export default router;