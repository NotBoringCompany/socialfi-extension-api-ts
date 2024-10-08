import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { claimWeeklyMVPRewards, fetchWeeklyMVPRankingData, getClaimableWeeklyMVPRewards } from '../api/weeklyMVPReward';
import { authMiddleware } from '../middlewares/auth';

const router = express.Router();

router.post('/claim_weekly_mvp_rewards', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_weekly_mvp_rewards');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await claimWeeklyMVPRewards(validateData?.twitterId);

        return res.status(status).json({
            status,
            message,
            data
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        });
    }
})

router.get('/get_claimable_weekly_mvp_rewards', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_claimable_weekly_mvp_rewards');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await getClaimableWeeklyMVPRewards(validateData?.twitterId);

        return res.status(status).json({
            status,
            message,
            data
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        });
    }
})

router.get('/fetch_weekly_mvp_ranking_data/:week', async (req, res) => {
    const { week } = req.params;
    try {
        const { status, message, data } = await fetchWeeklyMVPRankingData(week as number | 'latest');

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