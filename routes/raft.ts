import express from 'express';
import { evolveRaft, getActualRaftSpeed, getRaft, getRaftActualStats } from '../api/raft';
import { validateRequestAuth } from '../utils/auth';
import { Status } from '../utils/retVal';
import { UserModel } from '../utils/constants/db';
import { RAFT_EVOLUTION_COST } from '../utils/constants/raft';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { UserWallet } from '../models/user';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { getMainWallet } from '../api/user';
import { EVOLVE_RAFT_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';

const router = express.Router();

router.get('/get_raft/:twitterId', async (req, res) => {
    const { twitterId } = req.params;

    try {
        const { status, message, data } = await getRaft(twitterId);

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

router.get('/get_raft_evolution_cost', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_raft_evolution_cost');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        // get the user's raft
        const { status: raftStatus, message: raftMessage, data: raftData } = await getRaft(validateData?.twitterId);

        if (raftStatus !== Status.SUCCESS) {
            return res.status(raftStatus).json({
                status: raftStatus,
                message: raftMessage
            })
        }

        const { currentLevel } = raftData.raft;

        // get the evolution cost
        const evolutionCost = RAFT_EVOLUTION_COST(currentLevel);

        return res.status(Status.SUCCESS).json({
            status: Status.SUCCESS,
            message: `(getRaftEvolutionCost) Successfully retrieved the evolution cost.`,
            data: {
                evolutionCost
            }
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message
        })
    }
})

router.post('/evolve_raft', async (req, res) => {
    try {
        const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'evolve_raft');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }

        const { status, message, data } = await evolveRaft(validateData?.twitterId);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Currency Tracker', {
                distinct_id: validateData?.twitterId,
                '_type': 'Evolve Raft',
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

router.get('/get_raft_actual_stats/:twitterId', async (req, res) => {
    const { twitterId } = req.params;

    try {
        const { status, message, data } = await getRaftActualStats(twitterId);

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