import express from 'express';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';
import { addLeaderboard, getLeaderboardRanking, getOwnLeaderboardRanking } from '../api/leaderboard';

const router = express.Router();

router.post('/add_leaderboard', async (req, res) => {
    const { leaderboardName, startTimestamp, adminKey } = req.body;

    try {
        const { status, message, data } = await addLeaderboard(leaderboardName, startTimestamp, adminKey);

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(500).json({
            status: Status.ERROR,
            message: err.message
        })
    }
});

router.get('/get_leaderboard_ranking/:leaderboardName', async (req, res) => {
    const { leaderboardName } = req.params;

    try {
        const { status, message, data } = await getLeaderboardRanking(leaderboardName);

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

router.get('/get_own_leaderboard_ranking/:leaderboardName', async (req, res) => {
    const { leaderboardName } = req.params;

    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_own_leaderboard_ranking');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await getOwnLeaderboardRanking(validateData?.twitterId, leaderboardName.toLocaleString());

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