import express from 'express';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { acceptPendingSquadMember, checkSquadCreationMethodAndCost, createSquad, declinePendingSquadMember, delegateLeadership, getSquadData, kickMember, leaveSquad, renameSquad, requestToJoinSquad, upgradeSquadLimit } from '../api/squad';
import { getLatestWeeklyLeaderboard } from '../api/squadLeaderboard';

const router = express.Router();

router.get('/get_latest_weekly_leaderboard', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_latest_weekly_leaderboard');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await getLatestWeeklyLeaderboard();

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

export default router;