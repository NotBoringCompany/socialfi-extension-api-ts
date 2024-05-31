import express from 'express';
import { claimDailyKOSRewards, claimWeeklyKOSRewards, getClaimableDailyKOSRewards, getOwnedKeyIDs } from '../api/kos';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';

const router = express.Router();

router.get('/get_owned_key_ids/:twitterId', async (req, res) => {
    const { twitterId } = req.params;
    try {
        const { status, message, data } = await getOwnedKeyIDs(twitterId);

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
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_weekly_kos_rewards');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await claimWeeklyKOSRewards(validateData?.twitterId);

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
})

export default router;